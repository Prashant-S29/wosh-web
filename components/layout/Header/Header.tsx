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

export const Header: React.FC = () => {
  const { isLoading, token } = useCheckAuthClient({
    redirect: false,
  });

  return (
    <header className="fixed w-full">
      <div className="container mx-auto flex items-center justify-between py-8">
        <div>
          <Link href="/" className="text-2xl font-semibold">
            Wosh.
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
            <div className="flex items-center gap-5">
              <Button variant="secondary" asChild size="sm" disabled={isLoading} className="h-9">
                <Link href="/login">Login</Link>
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
