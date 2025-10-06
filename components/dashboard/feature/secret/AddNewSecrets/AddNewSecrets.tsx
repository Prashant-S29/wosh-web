'use client';

import React, { useState, useRef } from 'react';

// zod and rhf
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// hooks
import { useQueryClient } from '@tanstack/react-query';
import { useMKDFConfig } from '@/hooks/useMKDFConfig';
import { useSecretAuthentication } from '@/hooks/useSecretAuthentication';
import { useTypedMutation } from '@/hooks';

// utils
import { encryptSecretsArray } from '@/lib/crypto/secret/crypto-utils.secret';

// types ans schema
import { CreateSecretRequest } from '@/types/api/request';
import { CreateSecretResponse } from '@/types/api/response';
import { SecretsFormSchema, SecretsFormValues } from '@/schema/secret';

// icons
import { Plus, X, FileText, Pencil, AlertTriangle, AlertCircle } from 'lucide-react';

// components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { SecretAuthModal } from '@/components/common';
import { Skeleton } from '@/components/ui/skeleton';

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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<number>>(new Set());
  const [duplicateKeyIndexes, setDuplicateKeyIndexes] = useState<number[]>([]);
  const [showNotes, setShowNotes] = useState<Set<number>>(new Set());

  // Use MKDF config hook
  const { mkdfConfig, isLoadingConfig } = useMKDFConfig({
    organizationId,
    userId,
    enabled: !!userId,
  });

  // Use authentication hook
  const { showAuthModal, isAuthenticating, openAuthModal, closeAuthModal, handleAuthentication } =
    useSecretAuthentication<SecretsFormValues>({
      projectId,
      organizationId,
      userId,
    });

  const createSecretMutation = useTypedMutation<CreateSecretRequest, CreateSecretResponse>({
    endpoint: `/api/secret/bulk?projectId=${projectId}`,
    method: 'POST',
  });

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

  const parseEnvContent = (content: string): ParsedEnvEntry[] => {
    const lines = content.split('\n');
    const parsed: ParsedEnvEntry[] = [];
    let currentEntry: Partial<ParsedEnvEntry> | null = null;
    let currentNote = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Handle comments as notes
      if (line.startsWith('#')) {
        currentNote = line.substring(1).trim();
        continue;
      }

      // Skip empty lines
      if (!line) {
        currentNote = '';
        continue;
      }

      const assignmentMatch = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);

      if (assignmentMatch) {
        // Save previous entry if exists
        if (currentEntry && currentEntry.key) {
          parsed.push({
            key: currentEntry.key,
            value: currentEntry.value || '',
            note: currentEntry.note || '',
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
          // Handle multi-line quoted values
          let multiLineValue = value.substring(1);
          let j = i + 1;

          while (j < lines.length) {
            const nextLine = lines[j];
            multiLineValue += '\n' + nextLine;

            if (nextLine.trim().endsWith('"')) {
              multiLineValue = multiLineValue.slice(0, -1);
              i = j;
              break;
            }
            j++;
          }
          value = multiLineValue;
        }

        currentEntry = {
          key,
          value,
          note: currentNote,
        };
        currentNote = '';
      } else if (currentEntry) {
        currentEntry.value = (currentEntry.value || '') + '\n' + line;
      }
    }

    // Add last entry
    if (currentEntry && currentEntry.key) {
      parsed.push({
        key: currentEntry.key,
        value: currentEntry.value || '',
        note: currentEntry.note || '',
      });
    }

    return parsed;
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file name matches .env pattern
    const validEnvPattern = /^\.env(\.[a-zA-Z0-9_-]+)?$/;
    if (!validEnvPattern.test(file.name)) {
      toast.error(
        'Invalid file name. Please select a .env file (e.g., .env, .env.local, .env.production)',
      );
      event.target.value = '';
      return;
    }

    try {
      const content = await file.text();
      const parsedEntries = parseEnvContent(content);

      if (parsedEntries.length === 0) {
        toast.error('No valid environment variables found in the file');
        return;
      }

      replace(parsedEntries);
      setVisibleSecrets(new Set());
      setShowNotes(
        new Set(
          parsedEntries
            .map((entry, index) => (entry.note ? index : null))
            .filter((index): index is number => index !== null),
        ),
      );

      toast.success(
        `Imported ${parsedEntries.length} secret${parsedEntries.length > 1 ? 's' : ''} from ${file.name}`,
      );
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error("Failed to read the file. Please ensure it's a valid text file.");
    } finally {
      // Reset file input
      event.target.value = '';
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedContent = event.clipboardData.getData('text/plain');
    const envLinePattern = /^[A-Z_][A-Z0-9_]*\s*=/m;
    const hasMultipleLines = pastedContent.includes('\n');
    const looksLikeEnv = hasMultipleLines && envLinePattern.test(pastedContent);

    if (looksLikeEnv) {
      event.preventDefault();

      try {
        const parsedEntries = parseEnvContent(pastedContent);

        if (parsedEntries.length > 0) {
          replace(parsedEntries);
          setVisibleSecrets(new Set());
          setShowNotes(
            new Set(
              parsedEntries
                .map((entry, index) => (entry.note ? index : null))
                .filter((index): index is number => index !== null),
            ),
          );
          toast.success(
            `Pasted ${parsedEntries.length} secret${parsedEntries.length > 1 ? 's' : ''}`,
          );
        }
      } catch (error) {
        console.error('Error parsing environment variables:', error);
        toast.error('Failed to parse environment variables');
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

  const onSubmit = async (values: SecretsFormValues) => {
    openAuthModal(values);
  };

  const onAuthentication = async (projectKey: Uint8Array, secrets: SecretsFormValues) => {
    const encryptionResult = await encryptSecretsArray(secrets.secrets, projectKey);

    if (encryptionResult.error || !encryptionResult.data) {
      toast.error(encryptionResult.message);
      return;
    }

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

    form.reset();
  };

  if (isLoadingConfig) {
    return (
      <div className="flex w-full max-w-5xl flex-col gap-4 rounded-lg border p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-[100px]" />
          <Skeleton className="h-5 w-[100px]" />
          <Skeleton className="h-5 w-[100px]" />
        </div>

        <Skeleton className="h-5 w-[80%]" />
        <Skeleton className="h-5 w-[80%]" />
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".env,.env.*"
                onChange={handleFileImport}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="mr-2 h-4 w-4" />
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
                <Button type="button" variant="outline" size="sm" onClick={() => form.reset()}>
                  Clear All
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    form.formState.isSubmitting || !form.formState.isValid || isAuthenticating
                  }
                >
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </form>
        </Form>

        <SecretAuthModal
          isOpen={showAuthModal}
          onClose={closeAuthModal}
          onAuth={(credentials) => handleAuthentication(credentials.credentials, onAuthentication)}
          requiresPin={mkdfConfig?.requiresPin ?? false}
          isLoading={isAuthenticating}
          title="Encrypt Secrets"
          description="Enter your credentials to encrypt and save secrets securely."
        />
      </CardContent>
    </Card>
  );
};
