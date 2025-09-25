'use client';

import React from 'react';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

import { AvailableOrganizations } from '@/components/dashboard/feature';
import { PageLoader } from '@/components/common';

const Dashboard: React.FC = () => {
  const { isLoading, session } = useCheckAuthClient({
    redirectTo: '/login',
    redirect: true,
  });

  return (
    <>
      {isLoading ? (
        <PageLoader />
      ) : (
        <main className="flex min-h-screen flex-col items-center justify-center gap-5">
          <h1 className="text-2xl font-semibold">
            Hey {session?.user?.name}! Welcome to your dashboard.
          </h1>

          <AvailableOrganizations />
        </main>
      )}
    </>
  );
};

export default Dashboard;
