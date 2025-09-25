import { Loader } from 'lucide-react';
import React from 'react';

export const PageLoader: React.FC = () => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <Loader className="animate-spin" />
    </div>
  );
};
