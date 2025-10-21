import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React from 'react';

export const Hero: React.FC = () => {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">

      <h1 className="text-[60px] leading-none font-medium">Manage your secrets</h1>
      <h1 className="text-brand text-[60px] leading-none font-medium">Safe and Securely</h1>
      <p className="mt-3 max-w-[700px] text-center text-lg font-medium">
        Introducing Wosh - A local first, zero knowledge and zero exposure secret manager build on
        top of browser based cryptography. Share secrets with your team without compromising
        security.
      </p>
      <div className="mt-5 flex items-center gap-3">
        <Button variant="default" asChild size="lg">
          <Link href="/dashboard">Start your project</Link>
        </Button>
        {/* <Button variant="secondary" asChild size="lg">
          <Link href="/login">Watch Demo</Link>
        </Button> */}
      </div>
    </main>
  );
};
