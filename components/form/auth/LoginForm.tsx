'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { saveToCookie } from '@/lib/utils.cookies';

// schema
import { LoginSchema, LoginSchemaType } from '@/schema';

// hooks
import { useTypedMutation } from '@/hooks';

// types
import { LoginRequest, LoginResponse } from '@/types/api';

//  rhf
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// components
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

export const LoginForm: React.FC = () => {
  const router = useRouter();

  // mutation
  const loginMutation = useTypedMutation<LoginRequest, LoginResponse>({
    endpoint: '/api/auth/signin',
    method: 'POST',
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
  });

  const form = useForm<LoginSchemaType>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (data: LoginSchemaType) => {
    console.log('Login form data:', data);
    loginMutation.mutate(data);
  };

  return (
    <div className='w-full max-w-[400px] flex flex-col gap-3 '>
      <Button asChild variant='secondary' className='w-fit border'>
        <Link href='/'>Home</Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type='email'
                        placeholder='m@example.com'
                        disabled={form.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='password'
                render={({ field }) => (
                  <FormItem>
                    <div className='flex items-center justify-between'>
                      <FormLabel>Password</FormLabel>
                      <Link
                        href='#'
                        className='text-sm underline-offset-4 hover:underline'
                      >
                        Forgot your password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input
                        type='password'
                        disabled={form.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='flex flex-col gap-3'>
                <Button
                  type='submit'
                  className='w-full'
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? 'Logging in...' : 'Login'}
                </Button>
                <ContinueWithGoogle />
              </div>
            </form>
          </Form>

          <div className='mt-4 text-center text-sm'>
            Don&apos;t have an account?{' '}
            <Link href='/signup' className='underline underline-offset-4'>
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
