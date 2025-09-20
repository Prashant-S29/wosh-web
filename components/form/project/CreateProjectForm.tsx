'use client';

import React, { useState } from 'react';

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
import { StoredOrgKeys } from '@/types/encryptions';
import { CreateProjectRequest } from '@/types/api/request';

// Utils and hooks
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { useQueryClient } from '@tanstack/react-query';
import { useTypedMutation, useTypedQuery } from '@/hooks';

// icons
import { Eye, EyeOff, Shield, Loader2 } from 'lucide-react';

// Components
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Crypto utilities
import { secureStorage } from '@/lib/crypto/org/secure-storage.org';
import { retrieveOrgPrivateKey, secureWipe } from '@/lib/crypto/org/crypto-utils.org';
import {
  generateProjectKey,
  wrapProjectKey,
  deriveProjectStorageKey,
  projectSecureStorage,
} from '@/lib/crypto/project';

interface CreateProjectFormProps {
  setOpen?: (open: boolean) => void;
  organizationId: string;
}

interface ProjectFormData extends CreateProjectSchemaType {
  masterPassphrase: string;
}

const ProjectFormSchema = CreateProjectSchema.extend({
  masterPassphrase: z
    .string()
    .min(12, 'Passphrase must be at least 12 characters')
    .max(128, 'Passphrase too long'),
});

export const CreateProjectForm: React.FC<CreateProjectFormProps> = ({
  setOpen,
  organizationId,
}) => {
  // Auth
  const { token } = useCheckAuthClient();
  const queryClient = useQueryClient();

  // States
  const [showPassphrase, setShowPassphrase] = useState(false);

  // Queries
  const { data: sessionData } = useTypedQuery<GetSessionResponse>({
    endpoint: '/api/auth/session',
    queryKey: ['user-session', token],
    enabled: !!token,
  });

  const { refetch: refetchOrgKeys } = useTypedQuery<RecoverOrgKeysResponse>({
    endpoint: `/api/organization/keys?ownerId=${sessionData?.data?.user?.id}&orgId=${organizationId}`,
    queryKey: ['organization-keys', sessionData?.data?.user?.id],
    enabled: false,
  });

  // Mutations
  const createProjectMutation = useTypedMutation<CreateProjectRequest, CreateProjectResponse>({
    endpoint: '/api/project',
    method: 'POST',
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(ProjectFormSchema),
    defaultValues: {
      name: '',
      masterPassphrase: '',
    },
  });

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

      // get keys from IndexedDB
      const orgKeysResult = await secureStorage.getOrgKeys(
        organizationId,
        sessionData.data.user.id,
      );

      let orgKeysData: StoredOrgKeys | null = null;

      if (orgKeysResult.error || !orgKeysResult.data) {
        console.error('Keys not found in IndexedDB:', orgKeysResult.message);

        // if failed or not found, attempt recovery from server
        try {
          const { data: serverKeysData, error: fetchError } = await refetchOrgKeys();

          if (fetchError) {
            console.error('Recovery query failed:', fetchError);
            toast.error('Failed to connect to server for key recovery');
            return;
          }

          if (!serverKeysData?.data) {
            console.error('Server response:', serverKeysData);
            toast.error(
              'Organization keys not found on server. Please contact your administrator.',
            );
            return;
          }

          // store recovered keys in indexdb
          const recoveredKeys: StoredOrgKeys = {
            iv: serverKeysData.data.encryptionIv,
            privateKeyEncrypted: serverKeysData.data.privateKeyEncrypted,
            publicKey: serverKeysData.data.publicKey,
            salt: serverKeysData.data.keyDerivationSalt,
          };

          const storeResult = await secureStorage.storeOrgKeys(
            organizationId,
            sessionData.data.user.id,
            recoveredKeys,
          );

          if (storeResult.error) {
            console.error('Failed to store recovered keys:', storeResult.error);
            toast.error(storeResult.message);
            return;
          }

          orgKeysData = recoveredKeys;
          toast.success('Organization keys recovered and stored successfully');
        } catch (error) {
          console.error('Error during key recovery:', error);
          toast.error('Failed to recover organization keys from server');
          return;
        }
      } else {
        orgKeysData = orgKeysResult.data;
      }

      // decrypt organization private key
      const privateKeyResult = await retrieveOrgPrivateKey(data.masterPassphrase, orgKeysData);

      if (privateKeyResult.error || !privateKeyResult.data) {
        console.error('Private key decryption failed:', privateKeyResult.error);

        // Check for passphrase error
        if (privateKeyResult.message === 'Incorrect master passphrase') {
          toast.error('Incorrect master passphrase. Please try again.');
          return;
        }

        toast.error(privateKeyResult.message);
        return;
      }

      orgPrivateKey = privateKeyResult.data;

      // generate project keys
      const projectKeyResult = generateProjectKey();
      if (projectKeyResult.error || !projectKeyResult.data) {
        console.error('Project key generation failed:', projectKeyResult.error);
        toast.error(projectKeyResult.message);
        return;
      }

      projectSymmetricKey = projectKeyResult.data;

      // wrap project key
      const wrappedKeyResult = await wrapProjectKey(projectSymmetricKey, orgPrivateKey);
      if (wrappedKeyResult.error || !wrappedKeyResult.data) {
        console.error('Project key wrapping failed:', wrappedKeyResult.error);
        toast.error(wrappedKeyResult.message);
        return;
      }

      // create project on server
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

      // derive storage key and store project key locally
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

      toast.success(`Project "${data.name}" created successfully`);
      queryClient.invalidateQueries({
        queryKey: ['project', organizationId],
      });
    } catch (error) {
      console.error('Unexpected error during project creation:', error);

      if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('network') || error.message.includes('fetch')) {
          toast.error('Network error. Please check your connection and try again.');
        } else if (error.message.includes('storage') || error.message.includes('IndexedDB')) {
          toast.error('Storage error. Please clear your browser data and try again.');
        } else {
          toast.error(`Project creation failed: ${error.message}`);
        }
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
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

  return (
    <div className="space-y-4">
      {/* Security Notice */}
      <Alert variant="default">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Your project uses your master passphrase to encrypt keys locally and is never sent to our
          servers. <strong>Please ensure you enter the correct passphrase.</strong>
        </AlertDescription>
      </Alert>

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
                      placeholder="Enter your master passphrase"
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
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={
              form.formState.isSubmitting || !form.watch('name') || !form.watch('masterPassphrase')
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
