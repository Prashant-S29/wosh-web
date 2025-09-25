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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Eye, EyeOff, Shield, Copy, Download, AlertTriangle, Smartphone } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateOrganizationRequest } from '@/types/api/request';
import { DeviceInfo } from '@/types/encryptions';

interface CreateOrganizationFormProps {
  setOpen?: (open: boolean) => void;
}

export const CreateOrganizationForm: React.FC<CreateOrganizationFormProps> = ({ setOpen }) => {
  // auth
  const { token } = useCheckAuthClient();

  // helper
  const queryClient = useQueryClient();
  const router = useRouter();

  // states
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirmPassphrase, setShowConfirmPassphrase] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isPassphraseGenerated, setIsPassphraseGenerated] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [deviceConfidence, setDeviceConfidence] = useState<'high' | 'medium' | 'low'>('low');
  const [isGeneratingFingerprint, setIsGeneratingFingerprint] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
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
      confirmPassphrase: '',
      pin: '',
      confirmPin: '',
      enablePinProtection: false,
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
    setIsLoading(true);
    try {
      // Check if secure storage is available
      const storageAvailable = secureStorage.isAvailable();
      if (!storageAvailable.data) {
        console.error('Storage check failed:', storageAvailable.error);
        toast.error(storageAvailable.message);
        setIsLoading(false);
        return;
      }

      if (!sessionData?.data?.user.id) {
        toast.error('You must be logged in to create an organization');
        setIsLoading(false);
        return;
      }

      if (!deviceFingerprint) {
        toast.error('Device fingerprint is required for security');
        setIsLoading(false);
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
        setIsLoading(false);
        return;
      }

      console.log('orgKeys.data', orgKeys.data);
      setIsLoading(false);

      // check is device is correctly registered
      if (
        !orgKeys.data.deviceFingerprint ||
        !orgKeys.data.deviceKeyEncrypted ||
        !orgKeys.data.deviceKeyIv ||
        !orgKeys.data.deviceKeySalt ||
        !orgKeys.data.combinationSalt
      ) {
        toast.error('Device registration failed');
        setIsLoading(false);
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
      data.confirmPassphrase = '';
      data.pin = '';
      data.confirmPin = '';

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
    form.setValue('confirmPassphrase', passphrase);
    setIsPassphraseGenerated(true);

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(passphrase);
      toast.success('Secure passphrase generated and copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.success('Secure passphrase generated');
      toast.error('Failed to copy to clipboard');
    }
  };

  const copyPassphraseToClipboard = async () => {
    const passphrase = form.watch('masterPassphrase');
    if (!passphrase) {
      toast.error('No passphrase to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(passphrase);
      toast.success('Passphrase copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  const downloadPassphrase = () => {
    const passphrase = form.watch('masterPassphrase');
    const orgName = form.watch('organizationName') || 'organization';

    if (!passphrase) {
      toast.error('No passphrase to download');
      return;
    }

    const generatedAt = new Date().toISOString();
    const fileName = `wosh-org-${orgName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${generatedAt}-passphrase.txt`;

    let content = `Organization: ${orgName}\nMaster Passphrase: ${passphrase}\n\nSECURITY FEATURES:\n`;
    content += `- Multi-Factor Key Derivation (MKDF) enabled\n`;
    content += `- PIN protection: ${form.watch('enablePinProtection') ? 'Enabled' : 'Disabled'}\n`;
    if (form.watch('enablePinProtection') && form.watch('pin')) {
      content += `- PIN: ${form.watch('pin')}\n`;
    }
    content += `- Device fingerprint confidence: ${deviceConfidence}\n\n`;
    content += `IMPORTANT: Store this information securely. Once lost, we cannot recover it.\n`;
    content += `Generated: ${generatedAt}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Security credentials downloaded successfully');
  };

  return (
    <div className="flex gap-5">
      <Card className="relative">
        <CardHeader>
          <CardTitle className="flex w-full items-center justify-between">
            Create a New Organization
          </CardTitle>
          <CardDescription>Create a new organization to manage your data securely.</CardDescription>
        </CardHeader>
        <CardContent className="w-[700px]">
          <div className="absolute top-0 -left-[420px] flex w-[400px] flex-col gap-5">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription className="flex">
                <p>
                  This organization will use <strong>Multi-Factor Key Derivation (MKDF)</strong> for
                  enhanced security. Your keys are protected by multiple factors and never stored on
                  our servers.
                </p>
              </AlertDescription>
            </Alert>

            {/* Device Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex w-full items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Device Security Status
                  </div>
                  {isGeneratingFingerprint ? 'loading..' : `(${deviceConfidence} confidence)`}
                </CardTitle>
              </CardHeader>
            </Card>

            {isPassphraseGenerated && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Attention Needed</AlertTitle>
                <AlertDescription>
                  Download your security credentials before proceeding. This includes your
                  passphrase and PIN (if enabled). Loss of these credentials means permanent loss of
                  access to your organization data.
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={downloadPassphrase}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Download Security Credentials
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/*  */}
            <div className="flex flex-col gap-2"></div>
          </div>
          <div className="">
            <div className="grid grid-cols-2 gap-5">{/* Security Notice */}</div>

            {/* Download Warning - shown after passphrase is generated */}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Organization Name */}
                <FormField
                  control={form.control}
                  name="organizationName"
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
                <div className="grid grid-cols-2 items-start gap-5">
                  <FormField
                    control={form.control}
                    name="masterPassphrase"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center justify-between">
                          <p>Master Passphrase</p>
                          {/* Master Passphrase */}
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={generateSecurePassphrase}
                            disabled={form.formState.isSubmitting}
                            className="text-accent-foreground text-xs underline"
                          >
                            Generate
                          </button>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassphrase ? 'text' : 'password'}
                              placeholder="Strong passphrase"
                              disabled={form.formState.isSubmitting}
                              {...field}
                            />
                            <div className="absolute top-0 right-0 flex h-full">
                              {field.value && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-full px-3"
                                  onClick={copyPassphraseToClipboard}
                                  title="Copy passphrase"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-full px-3"
                                onClick={() => setShowPassphrase(!showPassphrase)}
                              >
                                {showPassphrase ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <EyeOff className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
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
                </div>

                {/* PIN Fields - only show if PIN protection is enabled */}
                {form.watch('enablePinProtection') && (
                  <div className="grid grid-cols-2 items-start gap-x-5 gap-y-2">
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
                                placeholder="Enter 4-8 digit PIN"
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
                              >
                                {showPin ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <EyeOff className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm PIN</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPin ? 'text' : 'password'}
                                placeholder="Re-enter your PIN"
                                disabled={form.formState.isSubmitting}
                                maxLength={8}
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute top-0 right-0 h-full px-3"
                                onClick={() => setShowConfirmPin(!showConfirmPin)}
                              >
                                {showConfirmPin ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <EyeOff className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <p className="text-muted-foreground col-span-2 px-1 text-sm">
                      This PIN will be required along with your passphrase to access the
                      organization.
                    </p>
                  </div>
                )}

                {/* Security Options */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Security Configuration</h3>

                  <FormField
                    control={form.control}
                    name="enablePinProtection"
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
                          <FormLabel>PIN Protection (Optional)</FormLabel>
                          <FormDescription>
                            Add an additional PIN for extra security. You&apos;ll need to enter this
                            PIN each time you access the organization.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={form.formState.isSubmitting || isGeneratingFingerprint || isLoading}
                  >
                    {form.formState.isSubmitting
                      ? `Creating ${form.watch('organizationName')}...`
                      : `Create ${form.watch('organizationName') || 'Organization'} with MKDF Security`}
                  </Button>

                  <p className="text-muted-foreground text-center text-xs">
                    By creating this organization, you acknowledge that lost credentials cannot be
                    recovered and will result in permanent data loss.
                  </p>
                </div>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
