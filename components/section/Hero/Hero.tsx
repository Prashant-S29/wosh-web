'use client';

import React from 'react';

// components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyIcon, TerminalIcon } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks';
import { toast } from 'sonner';

export const Hero: React.FC = () => {
  const { copyToClipboard } = useCopyToClipboard();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <Badge variant="secondary" className="rounded-full px-3 py-1">
        Beta Testing v1
      </Badge>
      <h1 className="text-[60px] leading-none font-medium">Manage your secrets</h1>
      <h1 className="text-brand text-[60px] leading-none font-medium">Safe and Securely</h1>
      <p className="mt-3 max-w-[700px] text-center text-lg font-medium">
        Introducing Wosh - A local first, zero knowledge and zero exposure secret manager build on
        top of browser based cryptography. Share secrets with your team without compromising
        security.
      </p>
      <div className="relative mt-5 flex items-center gap-3 rounded-lg border px-3 py-2 leading-none duration-100">
        <TerminalIcon className="text-muted-foreground w-4" />{' '}
        <p className="font-mono">npm install -g wosh</p>
        <Button
          variant="default"
          size="icon"
          onClick={() => {
            copyToClipboard('npm install -g wosh');
            toast.info('Copied to clipboard');
          }}
        >
          <CopyIcon />
        </Button>
      </div>
    </main>
  );
};
