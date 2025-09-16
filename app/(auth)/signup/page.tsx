import React from 'react';
import { SignupForm } from '@/components/form/auth';

const Signup: React.FC = () => {
  return (
    <div className='w-full h-screen flex justify-center items-center flex-col'>
      <SignupForm />
    </div>
  );
};

export default Signup;
