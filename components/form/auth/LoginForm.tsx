'use client';

import React, { useState } from 'react';
import Link from 'next/link';

// schema
import { SignupSchema, SignupSchemaType } from '@/schema';

// hooks
import { useTypedMutation } from '@/hooks';

// types
import { SignUpVerificationOtpRequest, SignupRequest } from '@/types/api/request';
import { SignUpVerificationOtpResponse, SignupResponse } from '@/types/api/response';

// rhf
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { saveToCookie } from '@/lib/utils.cookies';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Logo } from '@/public';

interface LoginFormProps {
  requestOrigin?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ requestOrigin }) => {
  const router = useRouter();

  const [isOtpSent, setIsOtpSent] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [otp, setOtp] = useState('');

  // mutation
  const signUpWithEmailOtpMutation = useTypedMutation<SignupRequest, SignupResponse>({
    endpoint: '/api/auth/signup-with-email-otp',
  });

  const reqSignUpOtpMutation = useTypedMutation<
    SignUpVerificationOtpRequest,
    SignUpVerificationOtpResponse
  >({
    endpoint: '/api/auth/req-signup-otp',
  });

  const form = useForm<SignupSchemaType>({
    resolver: zodResolver(SignupSchema),
    defaultValues: {
      email: '',
    },
  });

  const onEmailSubmit = async (data: SignupSchemaType) => {
    const reqSignUpOtpResponse = await reqSignUpOtpMutation.mutateAsync({
      email: data.email,
    });

    if (reqSignUpOtpResponse.error || !reqSignUpOtpResponse.data?.success) {
      toast.error('Unable to send verification otp. Please try again later.');
      return;
    }

    toast.success('Verification OTP sent successfully.');
    setUserEmail(data.email);
    setIsOtpSent(true);
  };

  const onOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    const signupResponse = await signUpWithEmailOtpMutation.mutateAsync({
      email: userEmail,
      otp,
    });

    if (signupResponse.error || !signupResponse.data?.token) {
      toast.error(signupResponse.message);
      setOtp('');
      return;
    }

    toast.success('Success');

    // set token to cookie
    saveToCookie('token', signupResponse.data.token);

    if (requestOrigin && requestOrigin === 'cli') {
      router.push('/cli/login-success');
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex flex-col items-center justify-center gap-4">
            <Link href="/">
              <Image src={Logo} alt="logo" width={30} height={30} />
            </Link>
            Welcome to Wosh {requestOrigin}
          </CardTitle>
          <CardDescription>
            {isOtpSent ? (
              <p>
                Enter the verification code sent to <br />
                <span className="text-primary font-medium">{form.watch('email')}</span>
                <br />
                {/* <span>Change email</span> */}
              </p>
            ) : (
              'Create a new account or login into an existing one'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isOtpSent ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="me@example.com"
                          {...field}
                          disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={form.formState.isSubmitting || reqSignUpOtpMutation.isPending}
                >
                  {form.formState.isSubmitting || reqSignUpOtpMutation.isPending
                    ? 'Sending...'
                    : 'Send Verification Code'}
                </Button>
              </form>
            </Form>
          ) : (
            <form onSubmit={onOtpSubmit} className="space-y-3">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                  disabled={signUpWithEmailOtpMutation.isPending}
                  maxLength={6}
                  className="mt-1 text-center text-2xl tracking-widest"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={signUpWithEmailOtpMutation.isPending || otp.length !== 6}
              >
                {signUpWithEmailOtpMutation.isPending ? 'Verifying...' : 'Verify'}
              </Button>
            </form>
          )}

          {isOtpSent && (
            <div
              className="flex justify-center"
              onClick={() => {
                setIsOtpSent(false);
                setOtp('');
              }}
            >
              <button className="text-muted-foreground mt-4 text-center text-sm">
                Not yours? Change email
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
