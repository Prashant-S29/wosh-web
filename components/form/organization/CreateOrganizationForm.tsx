'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// Schema
import { CreateOrganizationSchema, type CreateOrganizationSchemaType } from '@/schema/organization';

// RHF and zod
import z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

// Crypto utilities
import { createOrganizationKeys } from '@/lib/crypto/org/crypto-utils.org';
import { secureStorage } from '@/lib/crypto/org/secure-storage.org';

// types
import { CreateOrganizationResponse, GetSessionResponse } from '@/types/api/response';
import { CreateOrganizationRequest } from '@/types/api/request';

// utils and hooks
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { useQueryClient } from '@tanstack/react-query';
import { useTypedMutation, useTypedQuery } from '@/hooks';

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
import { Eye, EyeOff, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateOrganizationFormProps {
  setOpen?: (open: boolean) => void;
}

interface OrgFormData extends CreateOrganizationSchemaType {
  masterPassphrase: string;
  confirmPassphrase: string;
}

const OrgFormSchema = CreateOrganizationSchema.extend({
  masterPassphrase: z
    .string()
    .min(12, 'Passphrase must be at least 12 characters')
    .max(128, 'Passphrase too long'),
  confirmPassphrase: z.string(),
}).refine((data) => data.masterPassphrase === data.confirmPassphrase, {
  message: "Passphrases don't match",
  path: ['confirmPassphrase'],
});

export const CreateOrganizationForm: React.FC<CreateOrganizationFormProps> = ({ setOpen }) => {
  // auth
  const { token } = useCheckAuthClient();

  // helper
  const queryClient = useQueryClient();
  const router = useRouter();

  // states
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirmPassphrase, setShowConfirmPassphrase] = useState(false);

  // mutation
  const createOrganizationMutation = useTypedMutation<
    CreateOrganizationRequest,
    CreateOrganizationResponse
  >({
    endpoint: '/api/organization',
  });

  const { data: sessionData } = useTypedQuery<GetSessionResponse>({
    endpoint: '/api/auth/session',
    queryKey: ['user-session', token],
    enabled: !!token,
  });

  const form = useForm<OrgFormData>({
    resolver: zodResolver(OrgFormSchema),
    defaultValues: {
      name: '',
      masterPassphrase: '',
      confirmPassphrase: '',
    },
  });

  const onSubmit = async (data: OrgFormData) => {
    try {
      // Check if secure storage is available
      const storageAvailable = secureStorage.isAvailable();
      if (!storageAvailable.data) {
        console.error('Storage check failed:', storageAvailable.error);
        toast.error(storageAvailable.message);
        return;
      }

      if (!sessionData?.data?.user.id) {
        toast.error('You must be logged in to create an organization');
        return;
      }

      // Generate cryptographic keys
      const orgKeys = await createOrganizationKeys(data.masterPassphrase);

      if (!orgKeys.data) {
        toast.error('Failed to create organization keys');
        return;
      }

      // Create organization on server
      const response = await createOrganizationMutation.mutateAsync({
        name: data.name,
        ownerId: sessionData.data.user.id,
        encryptionIv: orgKeys.data.iv,
        keyDerivationSalt: orgKeys.data.salt,
        privateKeyEncrypted: orgKeys.data.privateKeyEncrypted,
        publicKey: orgKeys.data.publicKey,
      });

      // invalidate organizations
      queryClient.invalidateQueries({
        queryKey: ['organizations', token],
      });

      if (!response.data?.id) {
        toast.error('Failed to create organization');
        return;
      }

      // Store keys locally
      await secureStorage.storeOrgKeys(response.data.id, sessionData.data.user.id, orgKeys.data);

      // Clear sensitive data from memory
      data.masterPassphrase = '';
      data.confirmPassphrase = '';

      toast.success(`Organization "${data.name}" created successfully`);
      setOpen?.(false);

      // Redirect to organization dashboard
      router.push(`/dashboard/organization/${response.data.id}`);
    } catch (error) {
      console.error('Error creating organization:', error);

      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to create organization');
      }
    }
  };

  const generateSecurePassphrase = () => {
    // Generate a secure passphrase with 4 random words
    const words = [
      'mountain',
      'river',
      'forest',
      'ocean',
      'cloud',
      'storm',
      'thunder',
      'lightning',
      'crystal',
      'diamond',
      'silver',
      'golden',
      'bright',
      'shadow',
      'lunar',
      'solar',
      'phoenix',
      'dragon',
      'eagle',
      'wolf',
      'tiger',
      'lion',
      'falcon',
      'shark',
    ];

    const randomWords = [];
    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * words.length);
      randomWords.push(words[randomIndex]);
    }

    const passphrase = randomWords.join('-') + '-' + Math.floor(Math.random() * 1000);

    form.setValue('masterPassphrase', passphrase);
    form.setValue('confirmPassphrase', passphrase);

    toast.success('Secure passphrase generated');
  };

  return (
    <div className="space-y-4">
      {/* Security Notice */}
      <Alert variant="warning">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Your organization will use zero-knowledge encryption. The master passphrase encrypts your
          keys locally and is never sent to our servers.
          <strong> Store master passphrase safely - we cannot recover it if lost.</strong>
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Organization Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization Name</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="e.g., Acme Corp"
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
                      placeholder="Enter a strong passphrase (min 12 characters)"
                      disabled={form.formState.isSubmitting}
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-0 right-0 h-full px-3"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                    >
                      {showPassphrase ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateSecurePassphrase}
                    disabled={form.formState.isSubmitting}
                  >
                    Generate Secure Passphrase
                  </Button>
                </div>
              </FormItem>
            )}
          />

          {/* Confirm Passphrase */}
          <FormField
            control={form.control}
            name="confirmPassphrase"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Passphrase</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirmPassphrase ? 'text' : 'password'}
                      placeholder="Re-enter your passphrase"
                      disabled={form.formState.isSubmitting}
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-0 right-0 h-full px-3"
                      onClick={() => setShowConfirmPassphrase(!showConfirmPassphrase)}
                    >
                      {showConfirmPassphrase ? (
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

          <div className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? `Creating ${form.watch('name')}...`
                : `Create ${form.watch('name') || 'Organization'}`}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
