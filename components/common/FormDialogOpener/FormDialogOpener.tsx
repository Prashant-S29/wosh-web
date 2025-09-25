'use client';

import React, { useState, cloneElement } from 'react';

// components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface DialogControlProps {
  setOpen: (open: boolean) => void;
}

export interface FormDialogOpenerProps {
  children: React.ReactElement<DialogControlProps>;
  className?: string;
  trigger: React.ReactNode;
  title: string;
  description: string;
}

export const FormDialogOpener: React.FC<FormDialogOpenerProps> = ({
  children,
  className,
  trigger,
  title,
  description,
}) => {
  const [open, setOpen] = useState(false);

  const childWithProps = cloneElement(children, { setOpen });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className={cn(className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {childWithProps}
      </DialogContent>
    </Dialog>
  );
};
