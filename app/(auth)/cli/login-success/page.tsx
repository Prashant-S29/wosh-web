import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

// assets
import { Logo } from '@/public';

const CliLoginSuccess: React.FC = () => {
  return (
    <main className="flex h-screen w-full flex-col items-center justify-center">
      <Link href="/">
        <Image src={Logo} alt="logo" width={60} height={60} />
      </Link>
      <h1 className="mt-5 text-2xl font-semibold">You have successfully logged in to Wosh CLI</h1>
      <p className="text-muted-foreground">
        You can now close this window and continue using the CLI.
      </p>
    </main>
  );
};

export default CliLoginSuccess;
