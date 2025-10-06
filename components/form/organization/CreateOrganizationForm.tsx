'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Schema
import { CreateOrganizationSchema, type CreateOrganizationSchemaType } from '@/schema/organization';

// RHF and zod
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

// Crypto utilities
import { createOrganizationKeysMKDF } from '@/lib/crypto/org/crypto-utils.org';
import { secureStorage } from '@/lib/crypto/org/secure-storage.org';
import { generateDeviceFingerprint, generateDeviceName } from '@/lib/crypto/org/device-fingerprint';

// types
import { CreateOrganizationResponse, GetSessionResponse } from '@/types/api/response';

// utils and hooks
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { useQueryClient } from '@tanstack/react-query';
import { useCopyToClipboard, useTypedMutation, useTypedQuery } from '@/hooks';

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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Eye, EyeOff, Copy } from 'lucide-react';
import { CreateOrganizationRequest } from '@/types/api/request';
import { DeviceInfo } from '@/types/encryptions';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface CreateOrganizationFormProps {
  setOpen?: (open: boolean) => void;
}

export const CreateOrganizationForm: React.FC<CreateOrganizationFormProps> = ({ setOpen }) => {
  // auth
  const { token } = useCheckAuthClient();

  // helper
  const queryClient = useQueryClient();
  const { copyToClipboard } = useCopyToClipboard();
  const router = useRouter();

  // states
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [deviceConfidence, setDeviceConfidence] = useState<'high' | 'medium' | 'low'>('low');
  const [isGeneratingFingerprint, setIsGeneratingFingerprint] = useState(true);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>();

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

  const form = useForm<CreateOrganizationSchemaType>({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: {
      organizationName: '',
      masterPassphrase: '',
      pin: '',
      enablePinProtection: false,
      signedUndertaking: false,
    },
  });

  // Generate device fingerprint
  useEffect(() => {
    const generateFingerprint = async () => {
      try {
        setIsGeneratingFingerprint(true);
        const result = await generateDeviceFingerprint();
        console.log(result);
        setDeviceFingerprint(result.fingerprint);
        setDeviceConfidence(result.confidence);
        setDeviceInfo(result.deviceInfo);
        // result.deviceInfo.user

        if (result.confidence === 'low') {
          toast.warning('Device fingerprinting has low reliability on this device');
        }
      } catch (error) {
        console.error('Failed to generate device fingerprint:', error);
        toast.error('Failed to generate device fingerprint');
      } finally {
        setIsGeneratingFingerprint(false);
      }
    };

    generateFingerprint();
  }, []);

  const onSubmit = async (data: CreateOrganizationSchemaType) => {
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

      if (!deviceFingerprint) {
        toast.error('Device fingerprint is required for security');
        return;
      }

      // Generate MKDF cryptographic
      const orgKeys = await createOrganizationKeysMKDF(
        data.masterPassphrase,
        deviceFingerprint,
        data.enablePinProtection ? data.pin : undefined,
        {
          requiredFactors: data.enablePinProtection ? 3 : 2,
          enabledFactors: data.enablePinProtection
            ? ['passphrase', 'device', 'pin']
            : ['passphrase', 'device'],
        },
      );

      if (!orgKeys.data) {
        console.error('MKDF key generation failed:', orgKeys.error);
        toast.error('Failed to create organization keys');
        return;
      }

      console.log('orgKeys.data', orgKeys.data);

      // check is device is correctly registered
      if (
        !orgKeys.data.deviceFingerprint ||
        !orgKeys.data.deviceKeyEncrypted ||
        !orgKeys.data.deviceKeyIv ||
        !orgKeys.data.deviceKeySalt ||
        !orgKeys.data.combinationSalt
      ) {
        toast.error('Device registration failed');
        return;
      }

      // Create organization on server
      const response = await createOrganizationMutation.mutateAsync({
        name: data.organizationName,
        ownerId: sessionData.data.user.id,
        encryptionIv: orgKeys.data.iv,
        keyDerivationSalt: orgKeys.data.salt,
        privateKeyEncrypted: orgKeys.data.privateKeyEncrypted,
        publicKey: orgKeys.data.publicKey,

        // MKDF data
        mkdfConfig: {
          mkdfVersion: orgKeys.data.mkdfVersion,
          requiredFactors: orgKeys.data.mkdfConfig.requiredFactors,
          factorConfig: orgKeys.data.mkdfConfig,
        },

        // device registration
        deviceInfo: {
          deviceName: generateDeviceName(deviceInfo),
          deviceFingerprint: orgKeys.data.deviceFingerprint,
          encryptedDeviceKey: orgKeys.data.deviceKeyEncrypted,
          encryptionIv: orgKeys.data.deviceKeyIv,
          keyDerivationSalt: orgKeys.data.deviceKeySalt,
          combinationSalt: orgKeys.data.combinationSalt,
          ...(orgKeys.data.pinSalt ? { pinSalt: orgKeys.data.pinSalt } : {}),
        },
      });

      console.log(response);

      // invalidate cache
      queryClient.invalidateQueries({
        queryKey: ['organizations', token],
      });

      if (!response.data?.id) {
        toast.error('Failed to create organization');
        return;
      }

      // Store MKDF keys locally
      await secureStorage.storeOrgKeysMKDF(
        response.data.id,
        sessionData.data.user.id,
        orgKeys.data,
      );

      // Clear sensitive data from memory
      data.masterPassphrase = '';
      data.pin = '';

      toast.success(
        `Organization "${data.organizationName}" created successfully with MKDF security`,
      );
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

  const generateSecurePassphrase = async () => {
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

    // Copy to clipboard
    const { success } = await copyToClipboard(passphrase);

    if (success) {
      toast.success('Secure passphrase generated and copied to clipboard');
    } else {
      toast.error('Failed to copy passphrase');
    }
  };

  const copyCredentials = async () => {
    const passphrase = form.watch('masterPassphrase');
    const orgName = form.watch('organizationName') || 'organization';

    if (!passphrase) {
      toast.error('No passphrase to copy');
      return;
    }

    const generatedAt = new Date().toISOString();

    let content = `Organization: ${orgName}\nMaster Passphrase: ${passphrase}\n\nSECURITY FEATURES:\n`;
    content += `- Multi-Factor Key Derivation (MKDF) enabled\n`;
    content += `- PIN protection: ${form.watch('enablePinProtection') ? 'Enabled' : 'Disabled'}\n`;
    if (form.watch('enablePinProtection') && form.watch('pin')) {
      content += `- PIN: ${form.watch('pin')}\n`;
    }
    content += `- Device fingerprint confidence: ${deviceConfidence}\n\n`;
    content += `IMPORTANT: Store this information securely. Once lost, we cannot recover it.\n`;
    content += `Generated: ${generatedAt}`;

    const { success } = await copyToClipboard(content);

    if (success) {
      toast.success('Security credentials copied successfully');
    } else {
      toast.error('Failed to copy security credentials');
    }
  };

  return (
    <div className="bg-accent/50 flex w-[700px] flex-col rounded-lg border">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <p className="text-sm font-medium">Create a New Organization</p>
        <Badge variant="outline">Device Confidence - {deviceConfidence.toUpperCase()}</Badge>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-5 border-b p-5">
            <FormField
              control={form.control}
              name="organizationName"
              render={({ field }) => (
                <FormItem className="grid grid-cols-3 items-start">
                  <FormLabel className="mt-1.5">Organization Name</FormLabel>
                  <FormControl className="col-span-2">
                    <section className="flex flex-col gap-2">
                      <Input
                        type="text"
                        placeholder="e.g., Acme Corp"
                        disabled={form.formState.isSubmitting}
                        {...field}
                      />
                      <FormDescription className="font-medium">
                        What&apos;s the name of your company or team?
                      </FormDescription>
                      <FormMessage />
                    </section>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="masterPassphrase"
              render={({ field }) => (
                <FormItem className="grid grid-cols-3 items-start">
                  <FormLabel className="mt-1.5">Master Passphrase</FormLabel>
                  <FormControl className="col-span-2">
                    <section className="flex flex-col gap-2">
                      <div className="relative">
                        <Input
                          type={showPassphrase ? 'text' : 'password'}
                          placeholder="Strong passphrase"
                          disabled={form.formState.isSubmitting}
                          maxLength={8}
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute top-1/2 right-0 h-full -translate-y-1/2 px-3"
                          onClick={() => setShowPassphrase(!showPassphrase)}
                        >
                          {showPassphrase ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <FormDescription className="font-medium">
                        This key will be used to encrypt and decrypt all the secrets in your
                        organization.{' '}
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={generateSecurePassphrase}
                          disabled={form.formState.isSubmitting}
                          className="text-primary text-xs font-semibold underline underline-offset-2"
                        >
                          Generate
                        </button>
                      </FormDescription>
                      <FormMessage />
                    </section>
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch('enablePinProtection') && (
              <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-3 items-start">
                    <FormLabel className="mt-1.5">Security PIN</FormLabel>
                    <FormControl className="col-span-2">
                      <div className="flex flex-col gap-2">
                        <div className="relative">
                          <Input
                            type={showPin ? 'text' : 'password'}
                            placeholder="Enter 4-8 digit PIN"
                            disabled={form.formState.isSubmitting}
                            maxLength={8}
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-1/2 right-0 h-full -translate-y-1/2 px-3"
                            onClick={() => setShowPin(!showPin)}
                          >
                            {showPin ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </Button>
                        </div>
                        <FormDescription className="font-medium">
                          This PIN will be required along with your passphrase to access the
                          organization.
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="enablePinProtection"
              render={({ field }) => (
                <FormItem className="col-span-2 flex flex-row items-start space-y-0 space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>PIN Protection</FormLabel>
                    <FormDescription>
                      Add an additional PIN for extra security. You&apos;ll need to enter this PIN
                      each time you access the organization.
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="signedUndertaking"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-y-0 space-x-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Important Security Notice</FormLabel>
                    <FormDescription>
                      I confirm that in case of losing all the credentials, I might get completely
                      locked out of this organization. These credentials cannot be recovered and
                      will result in permanent loss of access to organization data.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <div className="flex items-center justify-between gap-3 p-5">
            <div>
              {form.watch('signedUndertaking') && (
                <Button type="button" size="sm" variant="outline" onClick={copyCredentials}>
                  <Copy className="" />
                  Copy Security Credentials
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                type="button"
                variant="secondary"
                asChild
                disabled={
                  form.formState.isSubmitting ||
                  isGeneratingFingerprint ||
                  !form.watch('signedUndertaking')
                }
              >
                <Link href="/dashboard">Cancel</Link>
              </Button>
              <Button
                size="sm"
                disabled={
                  form.formState.isSubmitting ||
                  isGeneratingFingerprint ||
                  !form.watch('signedUndertaking')
                }
              >
                Create Organization
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};
