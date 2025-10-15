import React from 'react';
import { LoginForm } from '@/components/form/auth';

interface LoginProps {
  searchParams: Promise<{ requestOrigin: string }>;
}

const Login: React.FC<LoginProps> = async ({ searchParams }) => {
  const { requestOrigin } = await searchParams;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <LoginForm requestOrigin={requestOrigin} />
    </div>
  );
};

export default Login;
