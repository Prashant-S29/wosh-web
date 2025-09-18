import React from 'react';
import { SignupForm } from '@/components/form/auth';

const Signup: React.FC = () => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <SignupForm />
    </div>
  );
};

export default Signup;
