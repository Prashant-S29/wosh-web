'use client';

import React from 'react';
import Link from 'next/link';

// schema
import { SignupSchema, SignupSchemaType } from '@/schema';

// hooks
import { useTypedMutation } from '@/hooks';

// types
import { SignupRequest, SignupResponse } from '@/types/api';

// rhf
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ContinueWithGoogle } from '@/components/feature';
import { toast } from 'sonner';
import { saveToCookie } from '@/lib/utils.cookies';
import { useRouter } from 'next/navigation';

export const SignupForm: React.FC = () => {
  const router = useRouter();

  // mutation
  const signupMutation = useTypedMutation<SignupRequest, SignupResponse>({
    endpoint: '/api/auth/signup',
    onSuccess: (data) => {
      if (data.error || !data.data?.token) {
        console.error(data.error);
        toast.error(data.message);
      } else {
        toast.success(data.message);

        // save token to cookie
        saveToCookie('token', data.data.token);
        router.push('/dashboard');
      }
    },

    onError: (error) => {
      console.error(error);
      toast.error('Unable to signup. Please try again later.');
    },
  });

  const form = useForm<SignupSchemaType>({
    resolver: zodResolver(SignupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignupSchemaType) => {
    await signupMutation.mutateAsync(data);
  };

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <Button asChild variant="secondary" className="w-fit border">
        <Link href="/">Home</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Let&apos;s get started</CardTitle>
          <CardDescription>Create a new account</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="wosh-member"
                        {...field}
                        disabled={form.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="m@example.com"
                        {...field}
                        disabled={form.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} disabled={form.formState.isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Creating account...' : 'Sign up'}
                </Button>
                <ContinueWithGoogle />
              </div>
            </form>
          </Form>

          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
