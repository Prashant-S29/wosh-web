'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

// hooks
import { useActiveOrg } from '@/hooks';

// components
import { AvailableProjects } from '@/components/dashboard/feature/project';
import { Container, PageLoader, ResourceHandler } from '@/components/common';

const Organization: React.FC = () => {
  const params = useParams();

  const { setActiveOrgId } = useActiveOrg();

  const id = params.orgId as string;

  const { isLoading, session } = useCheckAuthClient({
    redirectTo: '/login',
    redirect: true,
  });

  // Set active org
  useEffect(() => {
    if (id) {
      setActiveOrgId(id);
    }
  }, [id, setActiveOrgId]);

  if (isLoading) return <PageLoader />;
  if (!session?.session.userId) return <ResourceHandler type="unauthorized" />;

  return (
    <Container className="mx-auto flex min-h-screen flex-col gap-5">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <AvailableProjects organizationId={id} />
    </Container>
  );
};

export default Organization;
