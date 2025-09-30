'use client';

import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// rhf and zod
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// helpers
import { secureStorage } from '@/lib/crypto/org';
import { encryptSecretsArray } from '@/lib/crypto/secret/crypto-utils.secret';

// hooks
import { ProjectKeyCredentials, useProjectKey } from '@/hooks/useProjectKey';
import { useTypedMutation } from '@/hooks';

// types
import { CreateSecretRequest } from '@/types/api/request';
import { CreateSecretResponse } from '@/types/api/response';

// icons
import { Plus, X, FileText, Pencil, AlertTriangle, AlertCircle } from 'lucide-react';

// schema
import { SecretsFormSchema, SecretsFormValues } from '@/schema/secret';

// components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { SecretAuthModal } from '@/components/common';

interface ParsedEnvEntry {
  key: string;
  value: string;
  note: string;
}

interface AddNewSecretsProps {
  organizationId: string;
  projectId: string;
  userId: string;
}
export const AddNewSecrets: React.FC<AddNewSecretsProps> = ({
  organizationId,
  projectId,
  userId,
}) => {
  // helper
  const queryClient = useQueryClient();

  // states
  const [visibleSecrets, setVisibleSecrets] = useState<Set<number>>(new Set());
  const [duplicateKeyIndexes, setDuplicateKeyIndexes] = useState<number[]>([]);
  const [showNotes, setShowNotes] = useState<Set<number>>(new Set());

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [mkdfConfig, setMkdfConfig] = useState<{
    requiresPin: boolean;
    requiredFactors: number;
    enabledFactors: string[];
  } | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [pendingSecrets, setPendingSecrets] = useState<SecretsFormValues | null>(null);

  const { isRecovering, recoverProjectKey, clearProjectKey } = useProjectKey(
    projectId,
    organizationId,
    userId,
  );

  // mutations
  const createSecretMutation = useTypedMutation<CreateSecretRequest, CreateSecretResponse>({
    endpoint: `/api/secret/bulk?projectId=${projectId}`,
    method: 'POST',
  });

  useEffect(() => {
    const loadMkdfConfig = async () => {
      try {
        setIsLoadingConfig(true);

        if (!userId) return;

        const orgKeysResult = await secureStorage.getOrgKeysMKDF(organizationId, userId);

        if (orgKeysResult.data) {
          setMkdfConfig({
            requiresPin: orgKeysResult.data.mkdfConfig.enabledFactors.includes('pin'),
            requiredFactors: orgKeysResult.data.mkdfConfig.requiredFactors,
            enabledFactors: orgKeysResult.data.mkdfConfig.enabledFactors,
          });
        } else {
          // Fallback: try to load from server (implement this API call)
          toast.warning('Security configuration not found locally');
        }
      } catch (error) {
        console.error('Error loading MKDF configuration:', error);
        toast.error('Failed to load security configuration');
      } finally {
        setIsLoadingConfig(false);
      }
    };

    if (userId) {
      loadMkdfConfig();
    }
  }, [organizationId, userId]);

  const form = useForm<SecretsFormValues>({
    resolver: zodResolver(SecretsFormSchema),
    defaultValues: {
      secrets: [{ key: '', value: '', note: '' }],
    },
    mode: 'onChange',
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'secrets',
  });

  const handleDuplicateKey = () => {
    const seen = new Map<string, number[]>();

    form.watch('secrets').forEach((secret, idx) => {
      const key = secret.key.trim();
      if (key) {
        if (!seen.has(key)) {
          seen.set(key, []);
        }
        seen.get(key)!.push(idx);
      }
    });

    setDuplicateKeyIndexes(
      Array.from(seen.values())
        .filter((arr) => arr.length > 1)
        .flat(),
    );
  };

  // Function to parse .env content
  const parseEnvContent = (content: string): ParsedEnvEntry[] => {
    const lines = content.split('\n');
    const parsed: ParsedEnvEntry[] = [];
    let currentEntry: Partial<ParsedEnvEntry> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) {
        continue;
      }

      // Check if line contains an assignment
      const assignmentMatch = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);

      if (assignmentMatch) {
        // If we have a pending entry, save it first
        if (currentEntry && currentEntry.key) {
          parsed.push({
            key: currentEntry.key,
            value: currentEntry.value || '',
            note: '',
          });
        }

        const [, key, valueStart] = assignmentMatch;
        let value = valueStart;

        // Handle quoted values
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        } else if (value.startsWith('"') && !value.endsWith('"')) {
          // Multi-line quoted value - collect until closing quote
          let multiLineValue = value.substring(1); // Remove opening quote
          let j = i + 1;

          while (j < lines.length) {
            const nextLine = lines[j];
            multiLineValue += '\n' + nextLine;

            if (nextLine.trim().endsWith('"')) {
              multiLineValue = multiLineValue.slice(0, -1); // Remove closing quote
              i = j; // Skip the processed lines
              break;
            }
            j++;
          }
          value = multiLineValue;
        }

        currentEntry = {
          key,
          value,
          note: '',
        };
      } else if (currentEntry) {
        // This might be a continuation of a multi-line value
        currentEntry.value = (currentEntry.value || '') + '\n' + line;
      }
    }

    // Don't forget the last entry
    if (currentEntry && currentEntry.key) {
      parsed.push({
        key: currentEntry.key,
        value: currentEntry.value || '',
        note: '',
      });
    }

    return parsed;
  };

  // Function to detect and parse .env content from clipboard
  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedContent = event.clipboardData.getData('text/plain');

    // Check if the pasted content looks like env content (multiple lines with KEY=VALUE pattern)
    const envLinePattern = /^[A-Z_][A-Z0-9_]*\s*=/m;
    const hasMultipleLines = pastedContent.includes('\n');
    const looksLikeEnv = hasMultipleLines && envLinePattern.test(pastedContent);

    if (looksLikeEnv) {
      event.preventDefault();

      try {
        const parsedEntries = parseEnvContent(pastedContent);

        if (parsedEntries.length > 0) {
          // Replace all current fields with parsed entries
          replace(parsedEntries);

          // Reset visibility states
          setVisibleSecrets(new Set());
          setShowNotes(
            new Set(
              parsedEntries
                .map((entry, index) => (entry.note ? index : null))
                .filter((index): index is number => index !== null),
            ),
          );

          // Show success message or toast here if needed
          console.log(`Imported ${parsedEntries.length} environment variables`);
        }
      } catch (error) {
        console.error('Error parsing environment variables:', error);
        // Handle error - maybe show a toast notification
      }
    }
  };

  const addSecret = () => {
    append({ key: '', value: '', note: '' });
  };

  const removeSecret = (index: number) => {
    if (fields.length === 1) return;
    remove(index);
    setVisibleSecrets((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      const adjustedSet = new Set(
        Array.from(newSet)
          .map((i) => (i > index ? i - 1 : i))
          .filter((i) => i >= 0),
      );
      return adjustedSet;
    });
    // Clean up notes visibility state
    setShowNotes((prev) => {
      const newSet = new Set(prev);
      newSet.delete(index);
      const adjustedSet = new Set(
        Array.from(newSet)
          .map((i) => (i > index ? i - 1 : i))
          .filter((i) => i >= 0),
      );
      return adjustedSet;
    });
  };

  const toggleNotes = (index: number) => {
    setShowNotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // const onSubmit = (values: SecretsFormValues) => {
  //   console.log('Form submitted:', values);
  // };

  const onSubmit = async (values: SecretsFormValues) => {
    try {
      console.log('Form submitted:', values);

      // // Validate input
      // if (!validateSecrets(values.secrets)) {
      //   return;
      // }

      // Store pending secrets and show auth modal
      setPendingSecrets(values);
      setShowAuthModal(true);
    } catch (error) {
      console.error('Error in form submission:', error);
      toast.error('An error occurred while processing secrets');
    }
  };

  const handleAuthentication = async (credentials: ProjectKeyCredentials) => {
    let projectKey: Uint8Array | null = null;

    try {
      if (!pendingSecrets) {
        toast.error('No secrets to encrypt');
        return;
      }

      // Recover project key
      const keyResult = await recoverProjectKey(credentials);

      console.log('keyResult', keyResult);

      if (keyResult.error || !keyResult.data) {
        toast.error(keyResult.message);
        return;
      }

      projectKey = keyResult.data;

      // Encrypt all secrets
      const encryptionResult = await encryptSecretsArray(pendingSecrets.secrets, projectKey);

      if (encryptionResult.error || !encryptionResult.data) {
        toast.error(encryptionResult.message);
        return;
      }

      console.log('Secrets encrypted successfully:', encryptionResult.data);

      console.log('formattedSecrets:', encryptionResult.data);

      const createSecretResponse = await createSecretMutation.mutateAsync({
        secrets: encryptionResult.data,
      });

      if (!createSecretResponse.data || createSecretResponse.error) {
        toast.error(createSecretResponse.message);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['secret', projectId] });

      toast.success(
        `Successfully encrypted and stored ${Array.isArray(createSecretResponse.data) ? createSecretResponse.data.length : 1} secrets`,
      );
      // Close modal and clear pending secrets
      setShowAuthModal(false);
      setPendingSecrets(null);
      form.reset();
    } catch (error) {
      console.error('Authentication/encryption failed:', error);
      toast.error('Failed to encrypt secrets');
    } finally {
      // Clear credentials from memory
      if (credentials.masterPassphrase) {
        credentials.masterPassphrase = '';
      }
      if (credentials.pin) {
        credentials.pin = '';
      }

      // Clear project key from memory
      clearProjectKey();
    }
  };

  const handleAuthModalClose = () => {
    setShowAuthModal(false);
    setPendingSecrets(null);
  };

  if (isLoadingConfig) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-600">Loading security configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-5xl">
      <CardHeader>
        <CardTitle>Add new Secrets</CardTitle>
        <CardDescription>Add new secrets to your project.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div key={field.id} className="group space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="grid w-full grid-cols-2 gap-2">
                      <div className="w-full">
                        <FormField
                          control={form.control}
                          name={`secrets.${index}.key`}
                          render={({ field: formField }) => (
                            <FormItem>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    placeholder="SECRET_KEY"
                                    className="bg-gray-50 pr-8 font-mono text-sm transition-colors focus:bg-white"
                                    {...formField}
                                    onPaste={(e) => handlePaste(e)}
                                    onChange={(e) => {
                                      formField.onChange(e);
                                      handleDuplicateKey();
                                    }}
                                  />

                                  {/* Duplicate key warning */}
                                  {duplicateKeyIndexes.includes(index) && (
                                    <div className="absolute top-1/2 right-2 -translate-y-1/2">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertCircle className="h-4 w-4 text-red-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>Duplicate Key</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  )}
                                </div>
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Value Field */}
                      <div className="w-full">
                        <FormField
                          control={form.control}
                          name={`secrets.${index}.value`}
                          render={({ field: formField }) => (
                            <FormItem>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    placeholder="Value"
                                    className={`resize-none pr-10 font-mono text-sm ${!visibleSecrets.has(index) ? 'text-security-disc' : ''}`}
                                    {...formField}
                                  />

                                  <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
                                    {form.watch(`secrets.${index}.key`)?.trim() &&
                                      !form.watch(`secrets.${index}.value`)?.trim() && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                          </TooltipTrigger>
                                          <TooltipContent className="w-[300px] max-w-fit text-center">
                                            Null values might lead to unexpected behaviors on your
                                            application.
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                      {showNotes.has(index) && (
                        <FormField
                          control={form.control}
                          name={`secrets.${index}.note`}
                          render={({ field: formField }) => (
                            <FormItem className="col-span-2">
                              <FormControl>
                                <Textarea
                                  placeholder="A note explaining what this secret is for"
                                  className="resize-none text-sm"
                                  rows={3}
                                  {...formField}
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleNotes(index)}
                        title="Add note"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSecret(index)}
                        disabled={fields.length === 1}
                        title={
                          fields.length === 1 ? 'Cannot remove the last field' : 'Remove secret'
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={addSecret}>
                <Plus className="mr-2 h-4 w-4" />
                Add Another
              </Button>
              <Button type="button" variant="outline" size="sm">
                <FileText className="h-4 w-4" />
                Import .env
              </Button>
              <span className="text-muted-foreground text-sm">
                or paste the .env contents above
              </span>
            </div>

            <div className="flex items-center justify-between pt-4">
              <span className="text-muted-foreground text-sm">
                {form.watch(`secrets.0.key`) ? fields.length : 0} secret{fields.length > 1 && 's'}
              </span>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => form.reset()}>
                  Clear All
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting || !form.formState.isValid || isRecovering}
                >
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </form>
        </Form>

        <SecretAuthModal
          isOpen={showAuthModal}
          onClose={handleAuthModalClose}
          onAuth={handleAuthentication}
          requiresPin={mkdfConfig?.requiresPin ?? false}
          isLoading={isRecovering}
          title="Encrypt Secrets"
          description="Enter your credentials to encrypt and save secrets securely."
        />
      </CardContent>
    </Card>
  );
};
