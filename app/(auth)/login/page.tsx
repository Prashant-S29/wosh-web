import React from 'react';
import { LoginForm } from '@/components/form/auth';

const Login: React.FC = () => {
  return (
    <div className='w-full h-screen flex justify-center items-center flex-col'>
      <LoginForm />
    </div>
  );
};

export default Login;
