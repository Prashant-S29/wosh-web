'use client';

import React from 'react';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

// hooks
import { useTypedQuery } from '@/hooks';

// types
import { GetSessionResponse } from '@/types/api/response';
import { AvailableOrganizations } from '@/components/dashboard/feature';

const Dashboard: React.FC = () => {
  const { token } = useCheckAuthClient({
    redirectTo: '/login',
  });

  const { data: sessionData } = useTypedQuery<GetSessionResponse>({
    endpoint: '/api/auth/session',
    queryKey: ['user-session', token],
    enabled: !!token,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5">
      <h1 className="text-2xl font-semibold">
        Hey {sessionData?.data?.user?.name}! Welcome to your dashboard.
      </h1>

      <AvailableOrganizations />
    </main>
  );
};

export default Dashboard;
