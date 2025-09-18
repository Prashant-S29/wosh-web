import React from 'react';
import { LoginForm } from '@/components/form/auth';

const Login: React.FC = () => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <LoginForm />
    </div>
  );
};

export default Login;
