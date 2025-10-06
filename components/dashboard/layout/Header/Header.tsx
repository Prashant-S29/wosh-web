'use client';

import React from 'react';
import Link from 'next/link';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

// components
import { HeaderUserProfile } from '@/components/feature';
import Image from 'next/image';
import { Logo } from '@/public';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useActiveOrg, useActiveProject } from '@/hooks';
import { SwitchOrg } from '../SwitchOrg';
import { SwitchProject } from '../SwitchProject';

export const Header: React.FC = () => {
  const { token } = useCheckAuthClient({
    redirect: false,
  });

  const pathName = usePathname();
  const { activeOrgId } = useActiveOrg();
  const { activeProjectId } = useActiveProject();

  return (
    <header className="bg-background fixed top-0 z-50 mx-auto flex w-full items-center justify-between border border-b p-4">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold">
          <Image src={Logo} width={20} height={20} alt="Logo" />
        </Link>

        <div className="bg-secondary mx-3 h-4 w-[1px] rotate-12" />

        {(pathName.includes('/organization/new') || pathName === '/dashboard') && (
          <p className="text-sm font-medium">Organizations</p>
        )}

        {pathName.includes('/organization') &&
          !pathName.includes('/organization/new') &&
          activeOrgId && <SwitchOrg activeOrgId={activeOrgId} />}

        {pathName.includes('/project') && activeProjectId && activeOrgId && (
          <div className="flex items-center gap-2">
            <div className="bg-secondary mr-3 h-4 w-[1px] rotate-12" />
            <SwitchProject activeProjectId={activeProjectId} organizationId={activeOrgId} />
          </div>
        )}
      </div>
      <div className="flex items-center">
        <div className="flex items-center gap-5">
          <Button variant="secondary" asChild size="sm">
            <Link href="/feedback">Feedback</Link>
          </Button>
          {token && <HeaderUserProfile token={token} />}
        </div>
      </div>
    </header>
  );
};
