'use client';

import React from 'react';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

// hooks
import { useTypedQuery } from '@/hooks';

// types
import { GetSessionResponse } from '@/types/api';

const Dashboard: React.FC = () => {
  const { token, isLoading } = useCheckAuthClient();

  const { data: sessionData } = useTypedQuery<GetSessionResponse>({
    endpoint: '/api/auth/session',
    queryKey: ['user-session', token],
    enabled: !!token,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-2xl font-semibold">Wosh. Dashboard</h1>

      {isLoading ? (
        <p>loading...</p>
      ) : (
        <div>
          <p>userName: {sessionData?.data?.user.name || 'na'}</p>
          <p>userEmail: {sessionData?.data?.user.email || 'na'}</p>
        </div>
      )}
    </main>
  );
};

export default Dashboard;
