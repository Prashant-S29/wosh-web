'use client';

import React from 'react';

// rhf and zod
import { z } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// icons
import { Eye, EyeOff, Lock } from 'lucide-react';

// hooks
import { ProjectKeyCredentials } from '@/hooks/useProjectKey';

// components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SecretAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuth: (credentials: ProjectKeyCredentials) => Promise<void>;
  requiresPin: boolean;
  isLoading?: boolean;
  title?: string;
  description?: string;
}

const createAuthSchema = (requiresPin: boolean) =>
  z.object({
    masterPassphrase: z
      .string()
      .min(1, 'Master passphrase is required')
      .min(8, 'Master passphrase must be at least 8 characters'),
    pin: requiresPin
      ? z
          .string()
          .min(4, 'PIN must be at least 4 characters')
          .max(8, 'PIN must not exceed 8 characters')
      : z.string().optional(),
  });

type AuthFormData = z.infer<ReturnType<typeof createAuthSchema>>;

export const SecretAuthModal: React.FC<SecretAuthModalProps> = ({
  isOpen,
  onClose,
  onAuth,
  requiresPin,
  isLoading = false,
  title = 'Authentication Required',
  description = 'Please enter your credentials to access secrets',
}: SecretAuthModalProps) => {
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const form = useForm<AuthFormData>({
    resolver: zodResolver(createAuthSchema(requiresPin)),
    defaultValues: {
      masterPassphrase: '',
      pin: '',
    },
  });

  const handleSubmit = async (data: AuthFormData) => {
    try {
      await onAuth({
        masterPassphrase: data.masterPassphrase,
        pin: data.pin,
      });

      // Clear form on success
      form.reset();
    } catch (error) {
      // Error handling is done in parent component
      console.error('Authentication failed:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="masterPassphrase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Master Passphrase
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type={showPassphrase ? 'text' : 'password'}
                        placeholder="Enter your master passphrase"
                        disabled={isLoading}
                        autoComplete="off"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-0 right-0 h-full px-3"
                        onClick={() => setShowPassphrase(!showPassphrase)}
                        disabled={isLoading}
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

            {requiresPin && (
              <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Security PIN
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPin ? 'text' : 'password'}
                          placeholder="Enter your security PIN"
                          disabled={isLoading}
                          autoComplete="off"
                          className="pr-10"
                          maxLength={10}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute top-0 right-0 h-full px-3"
                          onClick={() => setShowPin(!showPin)}
                          disabled={isLoading}
                        >
                          {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? 'Authenticating...' : 'Authenticate'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
