'use client';

import React, { useState } from 'react';
import { CreateProjectSchema, type CreateProjectSchemaType } from '@/schema/project';
import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { GetSessionResponse, CreateProjectResponse } from '@/types/api/response';
import { CreateProjectRequest } from '@/types/api/request';
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { useQueryClient } from '@tanstack/react-query';
import { useTypedMutation, useTypedQuery } from '@/hooks';
import { useMKDFConfig } from '@/hooks/useMKDFConfig';
import { Eye, EyeOff, Shield, Loader2, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
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
import { secureStorage } from '@/lib/crypto/org/secure-storage.org';
import { retrieveOrgPrivateKeyMKDF, secureWipe } from '@/lib/crypto/org/crypto-utils.org';
import {
  generateProjectKey,
  wrapProjectKey,
  deriveProjectStorageKey,
  projectSecureStorage,
} from '@/lib/crypto/project';
import { ProjectsMKDFConfig } from '@/types/encryptions';
import { ProjectKeyCredentials } from '@/hooks/useProjectKey';

interface CreateProjectFormProps {
  setOpen?: (open: boolean) => void;
  organizationId: string;
}

interface ProjectFormData extends CreateProjectSchemaType, ProjectKeyCredentials {}

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
  const { token } = useCheckAuthClient();
  const queryClient = useQueryClient();
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const { data: sessionData } = useTypedQuery<GetSessionResponse>({
    endpoint: '/api/auth/session',
    queryKey: ['user-session', token],
    enabled: !!token,
  });

  // Use MKDF config hook
  const { mkdfConfig, isLoadingConfig, deviceVerified, deviceFingerprint } = useMKDFConfig({
    organizationId,
    userId: sessionData?.data?.user?.id || '',
    enabled: !!sessionData?.data?.user?.id,
  });

  const createProjectMutation = useTypedMutation<CreateProjectRequest, CreateProjectResponse>({
    endpoint: '/api/project',
    method: 'POST',
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(createProjectFormSchema(mkdfConfig)),
    defaultValues: {
      name: '',
      masterPassphrase: '',
      pin: '',
    },
  });

  const onSubmit = async (data: ProjectFormData) => {
    let orgPrivateKey: Uint8Array | null = null;
    let projectSymmetricKey: Uint8Array | null = null;

    try {
      const storageAvailable = secureStorage.isAvailable();
      if (!storageAvailable.data) {
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

      const orgKeysData = orgKeysResult.data;

      if (orgKeysData.deviceFingerprint !== deviceFingerprint) {
        toast.error(
          'Device verification failed. This device is not registered for this organization.',
        );
        return;
      }

      if (mkdfConfig?.requiresPin && !data.pin) {
        toast.error('PIN is required for this organization');
        return;
      }

      const privateKeyResult = await retrieveOrgPrivateKeyMKDF(
        data.masterPassphrase,
        deviceFingerprint,
        data.pin,
        orgKeysData,
      );

      if (privateKeyResult.error) {
        toast.error(privateKeyResult.message);
        return;
      }

      orgPrivateKey = privateKeyResult.data;

      const projectKeyResult = generateProjectKey();
      if (projectKeyResult.error || !projectKeyResult.data) {
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
        toast.error(wrappedKeyResult.message);
        return;
      }

      const response = await createProjectMutation.mutateAsync({
        name: data.name,
        organizationId: organizationId,
        wrappedSymmetricKey: JSON.stringify(wrappedKeyResult.data),
      });

      if (!response.data?.id) {
        toast.error('Failed to create project. Please try again.');
        return;
      }

      const storageKeyResult = await deriveProjectStorageKey(orgPrivateKey, response.data.id);
      if (storageKeyResult.error || !storageKeyResult.data) {
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
        secureWipe(orgPrivateKey);
      }
      if (projectSymmetricKey) {
        secureWipe(projectSymmetricKey);
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
          <CardHeader>
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
