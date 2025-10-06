'use client';

import React from 'react';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

import { AvailableOrganizations } from '@/components/dashboard/feature';
import { Container, PageLoader } from '@/components/common';

const Dashboard: React.FC = () => {
  const { isLoading } = useCheckAuthClient({
    redirectTo: '/login',
    redirect: true,
  });

  return (
    <>
      {isLoading ? (
        <PageLoader />
      ) : (
        <Container className="mx-auto flex min-h-screen flex-col gap-5">
          <h1 className="text-2xl font-semibold">Your Organizations</h1>
          <AvailableOrganizations />
        </Container>
      )}
    </>
  );
};

export default Dashboard;
