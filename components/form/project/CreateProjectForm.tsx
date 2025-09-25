'use client';

import React, { useState, useEffect } from 'react';

// Schema
import { CreateProjectSchema, type CreateProjectSchemaType } from '@/schema/project';

// RHF and zod
import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

// Types
import {
  GetSessionResponse,
  RecoverOrgKeysResponse,
  CreateProjectResponse,
} from '@/types/api/response';
import { CreateProjectRequest } from '@/types/api/request';

// Utils and hooks
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { useQueryClient } from '@tanstack/react-query';
import { useTypedMutation, useTypedQuery } from '@/hooks';

// icons
import { Eye, EyeOff, Shield, Loader2, Lock, CheckCircle, AlertTriangle } from 'lucide-react';

// Components
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Crypto utilities
import { secureStorage } from '@/lib/crypto/org/secure-storage.org';
import { retrieveOrgPrivateKeyMKDF, secureWipe } from '@/lib/crypto/org/crypto-utils.org';
import {
  generateProjectKey,
  wrapProjectKey,
  deriveProjectStorageKey,
  projectSecureStorage,
} from '@/lib/crypto/project';
import { generateDeviceFingerprint } from '@/lib/crypto/org/device-fingerprint';
import { ProjectsMKDFConfig } from '@/types/encryptions';

interface CreateProjectFormProps {
  setOpen?: (open: boolean) => void;
  organizationId: string;
}

interface ProjectFormData extends CreateProjectSchemaType {
  masterPassphrase: string;
  pin?: string | undefined;
}

// Dynamic schema based on MKDF requirements
const createProjectFormSchema = (mkdfConfig: ProjectsMKDFConfig | null) => {
  const baseSchema = CreateProjectSchema.extend({
    masterPassphrase: z
      .string()
      .min(12, 'Passphrase must be at least 12 characters')
      .max(128, 'Passphrase too long'),
  });

  if (mkdfConfig?.requiresPin) {
    return baseSchema.extend({
      pin: z
        .string()
        .min(4, 'PIN must be at least 4 digits')
        .max(8, 'PIN must not exceed 8 digits'),
    });
  }

  return baseSchema.extend({
    pin: z.string().optional(),
  });
};

export const CreateProjectForm: React.FC<CreateProjectFormProps> = ({
  setOpen,
  organizationId,
}) => {
  // Auth
  const { token } = useCheckAuthClient();
  const queryClient = useQueryClient();

  // States
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [mkdfConfig, setMkdfConfig] = useState<ProjectsMKDFConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [deviceVerified, setDeviceVerified] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');

  // Queries
  const { data: sessionData } = useTypedQuery<GetSessionResponse>({
    endpoint: '/api/auth/session',
    queryKey: ['user-session', token],
    enabled: !!token,
  });

  const { refetch: refetchOrgKeys } = useTypedQuery<RecoverOrgKeysResponse>({
    endpoint: `/api/organization/keys?orgId=${organizationId}`,
    queryKey: ['organization-keys', organizationId, sessionData?.data?.user?.id],
    enabled: false,
  });

  // Mutations
  const createProjectMutation = useTypedMutation<CreateProjectRequest, CreateProjectResponse>({
    endpoint: '/api/project',
    method: 'POST',
  });

  // Form with dynamic schema
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(createProjectFormSchema(mkdfConfig)),
    defaultValues: {
      name: '',
      masterPassphrase: '',
      pin: '',
    },
  });

  // Load MKDF configuration on mount
  useEffect(() => {
    const loadMkdfConfig = async () => {
      try {
        setIsLoadingConfig(true);

        if (!sessionData?.data?.user.id) {
          return;
        }

        // Generate device fingerprint first
        const fingerprintResult = await generateDeviceFingerprint();
        if (fingerprintResult.fingerprint) {
          setDeviceFingerprint(fingerprintResult.fingerprint);
          setDeviceVerified(fingerprintResult.confidence !== 'low');

          if (fingerprintResult.confidence === 'low') {
            toast.warning('Device fingerprinting has low reliability on this device');
          }
        }

        // load security configuration from indexdb
        const orgKeysResult = await secureStorage.getOrgKeysMKDF(
          organizationId,
          sessionData.data.user.id,
        );
        console.log('orgKeysResult', orgKeysResult);

        // if not found, get from the server
        if (!orgKeysResult.data) {
          try {
            const { data: serverKeysData } = await refetchOrgKeys();
            console.log('serverKeysData', serverKeysData);

            // if keys not found on server
            if (!serverKeysData?.data?.factorConfig) {
              toast.error('Failed to load security configuration from server');
              return;
            }

            const mkdfConfigData: ProjectsMKDFConfig = {
              requiredFactors: serverKeysData.data.factorConfig.requiredFactors,
              enabledFactors: serverKeysData.data.factorConfig.enabledFactors,
              requiresPin: serverKeysData.data.factorConfig.enabledFactors.includes('pin'),
            };

            setMkdfConfig(mkdfConfigData);

            // store the keys back to indexdb
            const storeOrgKeysResponse = await secureStorage.storeOrgKeysMKDF(
              organizationId,
              sessionData.data.user.id,
              {
                combinationSalt: serverKeysData.data.deviceInfo.combinationSalt,
                iv: serverKeysData.data.encryptionIv,
                publicKey: serverKeysData.data.publicKey,
                privateKeyEncrypted: serverKeysData.data.privateKeyEncrypted,
                salt: serverKeysData.data.keyDerivationSalt,
                ...(serverKeysData.data.deviceInfo.pinSalt
                  ? { pinSalt: serverKeysData.data.deviceInfo.pinSalt }
                  : {}),
                mkdfConfig: {
                  enabledFactors: mkdfConfigData.enabledFactors,
                  requiredFactors: mkdfConfigData.requiredFactors,
                },
                deviceFingerprint: serverKeysData.data.deviceInfo.deviceFingerprint,
                deviceKeyEncrypted: serverKeysData.data.deviceInfo.encryptedDeviceKey,
                deviceKeyIv: serverKeysData.data.deviceInfo.keyDerivationSalt,
                deviceKeySalt: serverKeysData.data.deviceInfo.keyDerivationSalt,
                mkdfVersion: serverKeysData.data.mkdfVersion,
              },
            );

            if (storeOrgKeysResponse.error) {
              console.warn('Failed to store MKDF keys locally:', storeOrgKeysResponse.error);
              toast.warning('Keys retrieved from server but could not be cached locally');
            } else {
              console.log('Successfully cached MKDF keys locally');
            }
            return;
          } catch (error) {
            console.error('Failed to load MKDF config from server:', error);
            toast.error('Failed to load security configuration from server');
            return;
          }
        }

        // We have local MKDF keys
        setMkdfConfig({
          requiresPin: orgKeysResult.data.mkdfConfig.enabledFactors.includes('pin'),
          requiredFactors: orgKeysResult.data.mkdfConfig.requiredFactors,
          enabledFactors: orgKeysResult.data.mkdfConfig.enabledFactors,
        });
      } catch (error) {
        console.error('Error loading MKDF configuration:', error);
        toast.error('Failed to load security configuration');
      } finally {
        setIsLoadingConfig(false);
      }
    };

    if (sessionData?.data?.user.id) {
      loadMkdfConfig();
    }
  }, [organizationId, refetchOrgKeys, sessionData?.data?.user.id]);

  const onSubmit = async (data: ProjectFormData) => {
    let orgPrivateKey: Uint8Array | null = null;
    let projectSymmetricKey: Uint8Array | null = null;

    try {
      const storageAvailable = secureStorage.isAvailable();
      if (!storageAvailable.data) {
        console.error('Storage check failed:', storageAvailable.error);
        toast.error(storageAvailable.message);
        return;
      }

      if (!sessionData?.data?.user.id) {
        toast.error('You must be logged in to create a project');
        return;
      }

      if (!deviceFingerprint) {
        toast.error('Device fingerprint verification required');
        return;
      }

      const orgKeysResult = await secureStorage.getOrgKeysMKDF(
        organizationId,
        sessionData.data.user.id,
      );

      if (!orgKeysResult.data) {
        toast.error('Organization keys not found');
        return;
      }

      // MKDF path
      const orgKeysData = orgKeysResult.data;

      // Verify device fingerprint matches
      if (orgKeysData.deviceFingerprint !== deviceFingerprint) {
        toast.error(
          'Device verification failed. This device is not registered for this organization.',
        );
        return;
      }

      // Validate PIN requirement
      if (mkdfConfig?.requiresPin && !data.pin) {
        toast.error('PIN is required for this organization');
        return;
      }

      // Decrypt using MKDF
      const privateKeyResult = await retrieveOrgPrivateKeyMKDF(
        data.masterPassphrase,
        deviceFingerprint,
        data.pin,
        orgKeysData,
      );

      console.log('privateKeyResult', privateKeyResult);
      if (privateKeyResult.error) {
        toast.error(privateKeyResult.message);
        return;
      }

      orgPrivateKey = privateKeyResult.data;

      const projectKeyResult = generateProjectKey();
      if (projectKeyResult.error || !projectKeyResult.data) {
        console.error('Project key generation failed:', projectKeyResult.error);
        toast.error(projectKeyResult.message);
        return;
      }

      projectSymmetricKey = projectKeyResult.data;

      if (!orgPrivateKey) {
        toast.error('Organization private key not found');
        return;
      }

      const wrappedKeyResult = await wrapProjectKey(projectSymmetricKey, orgPrivateKey);
      if (wrappedKeyResult.error || !wrappedKeyResult.data) {
        console.error('Project key wrapping failed:', wrappedKeyResult.error);
        toast.error(wrappedKeyResult.message);
        return;
      }

      console.log('wrappedKeyResult', wrappedKeyResult);

      const response = await createProjectMutation.mutateAsync({
        name: data.name,
        organizationId: organizationId,
        wrappedSymmetricKey: JSON.stringify(wrappedKeyResult.data),
      });

      if (!response.data?.id) {
        console.error('Server failed to create project:', response);
        toast.error('Failed to create project. Please try again.');
        return;
      }

      const storageKeyResult = await deriveProjectStorageKey(orgPrivateKey, response.data.id);
      if (storageKeyResult.error || !storageKeyResult.data) {
        console.error('Storage key derivation failed:', storageKeyResult.error);
        toast.error(storageKeyResult.message);
        return;
      }

      const storeResult = await projectSecureStorage.storeProjectKey(
        response.data.id,
        organizationId,
        projectSymmetricKey,
        wrappedKeyResult.data,
        storageKeyResult.data,
      );

      if (storeResult.error) {
        console.error('Failed to store project key locally:', storeResult.error);
        toast.error(storeResult.message);
        return;
      }

      const securityMode = mkdfConfig
        ? mkdfConfig?.requiredFactors > 1
          ? 'MKDF security'
          : 'standard security'
        : 'standard security';
      toast.success(`Project "${data.name}" created successfully with ${securityMode}`);

      queryClient.invalidateQueries({
        queryKey: ['project', organizationId],
      });
    } catch (error) {
      console.error('Unexpected error during project creation:', error);
      toast.error('An unexpected error occurred during project creation.');
    } finally {
      if (orgPrivateKey) {
        const wipeResult = secureWipe(orgPrivateKey);
        if (wipeResult.error) {
          console.warn('Failed to wipe organization private key:', wipeResult.error);
        }
      }
      if (projectSymmetricKey) {
        const wipeResult = secureWipe(projectSymmetricKey);
        if (wipeResult.error) {
          console.warn('Failed to wipe project symmetric key:', wipeResult.error);
        }
      }
      form.reset();
      setOpen?.(false);
    }
  };

  if (isLoadingConfig) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-muted-foreground text-sm">Loading security configuration...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Security Status */}
      {mkdfConfig && (
        <Card className="gap-3">
          <CardHeader className="">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4" />
              Security Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                {mkdfConfig.requiredFactors > 1 ? 'Multi-Factor Security' : 'Standard Security'}(
                {mkdfConfig.requiredFactors} factor{mkdfConfig.requiredFactors !== 1 ? 's' : ''})
              </span>
            </div>

            {mkdfConfig.enabledFactors.includes('device') && (
              <div className="flex items-center gap-2">
                {deviceVerified ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                )}
                <span className="text-sm">
                  Device Verification: {deviceVerified ? 'Ready' : 'Low Confidence'}
                </span>
              </div>
            )}

            <div className="text-muted-foreground text-xs">
              Required:{' '}
              {mkdfConfig.enabledFactors.join(', ').replace('passphrase', 'master passphrase')}
            </div>
          </CardContent>
        </Card>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Project Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="e.g., Backend Secrets v1"
                    disabled={form.formState.isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormDescription>A descriptive name for your project</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Master Passphrase */}
          <FormField
            control={form.control}
            name="masterPassphrase"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Master Passphrase</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassphrase ? 'text' : 'password'}
                      placeholder="Enter your organization master passphrase"
                      disabled={form.formState.isSubmitting}
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-0 right-0 h-full px-3"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      disabled={form.formState.isSubmitting}
                    >
                      {showPassphrase ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>The master passphrase for this organization</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* PIN Field - only show if required by MKDF */}
          {mkdfConfig?.requiresPin && (
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Security PIN</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPin ? 'text' : 'password'}
                        placeholder="Enter your organization PIN"
                        disabled={form.formState.isSubmitting}
                        maxLength={8}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-0 right-0 h-full px-3"
                        onClick={() => setShowPin(!showPin)}
                        disabled={form.formState.isSubmitting}
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription>
                    The additional PIN required for this organization
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              form.formState.isSubmitting ||
              !form.watch('name') ||
              !form.watch('masterPassphrase') ||
              (mkdfConfig?.requiresPin && !form.watch('pin'))
            }
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Project...
              </>
            ) : (
              `Create ${form.watch('name') || 'Project'}`
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
};
