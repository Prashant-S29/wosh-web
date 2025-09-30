'use client';

import React from 'react';
import { useParams } from 'next/navigation';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

// hooks
import { useTypedQuery } from '@/hooks';

// types
import { GetOrganizationResponse } from '@/types/api/response';

// components
import { AvailableProjects } from '@/components/dashboard/feature/project';

const Organization: React.FC = () => {
  const params = useParams();
  const id = params.orgId as string;

  useCheckAuthClient({
    redirectTo: '/login',
    redirect: true,
  });

  // get org info
  const { data: orgData } = useTypedQuery<GetOrganizationResponse>({
    endpoint: `/api/organization/${id}`,
    queryKey: ['organization', id],
    enabled: !!id,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5">
      <h1 className="text-2xl font-semibold">{orgData?.data?.name} dashboard</h1>

      {id && <AvailableProjects organizationId={id} />}
    </main>
  );
};

export default Organization;
