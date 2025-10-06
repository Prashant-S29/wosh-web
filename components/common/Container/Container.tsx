import { cn } from '@/lib/utils';
import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const Container: React.FC<ContainerProps> = ({ children, className }) => {
  return (
    <div className={cn('container mx-auto flex flex-col gap-5 px-[100px] py-[150px]', className)}>
      {children}
    </div>
  );
};
