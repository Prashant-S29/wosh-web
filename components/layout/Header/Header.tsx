'use client';

import React from 'react';
import Link from 'next/link';

// data
// import { navLinks } from './data';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

// components
import { Button } from '@/components/ui/button';
import { HeaderUserProfile } from '@/components/feature';
import Image from 'next/image';
import { Logo } from '@/public';

export const Header: React.FC = () => {
  const { isLoading, token } = useCheckAuthClient({
    redirect: false,
  });

  return (
    <header className="fixed z-50 w-full border border-b">
      <div className="border-b border-amber-400/60 bg-amber-500/10 py-3 text-center">
        <p className="text-sm font-medium">
          This is the beta version. Please report any issues or bugs you find.
        </p>
      </div>
      <div className="container mx-auto flex items-center justify-between py-4">
        <div>
          <Link href="/" className="flex items-center gap-2 text-xl font-semibold">
            <Image src={Logo} width={24} height={24} alt="Logo" />
            Wosh
          </Link>
        </div>
        <div className="flex items-center">
          {/* <nav className="flex items-center gap-5">
            {navLinks.map((link) => (
              <Button key={link.name} variant="ghost" asChild>
                <Link href={link.href}>{link.name}</Link>
              </Button>
            ))}
          </nav>

          <div className="bg-foreground mr-8 ml-5 h-5 w-[1px]" /> */}

          {token ? (
            <div className="flex items-center gap-5">
              <Button variant="default" asChild size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <HeaderUserProfile token={token} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="secondary" asChild size="sm" disabled={isLoading}>
                <Link href="/login">Sing in</Link>
              </Button>
              <Button variant="default" asChild size="sm" disabled={isLoading}>
                <Link href="/dashboard">Start your project</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
