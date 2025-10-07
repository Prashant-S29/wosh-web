'use client';

import React, { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

// components
import { AddNewSecrets, AvailableSecrets } from '@/components/dashboard/feature';
import { Container, PageLoader, ResourceHandler } from '@/components/common';
import { useActiveOrg, useActiveProject } from '@/hooks';

const Project: React.FC = () => {
  const params = useParams();
  const id = useMemo(
    () => [params.orgId, params.projectId] as string[],
    [params.orgId, params.projectId],
  );

  const { setActiveProjectId } = useActiveProject();
  const { setActiveOrgId } = useActiveOrg();

  const { session, isLoading } = useCheckAuthClient({
    redirectTo: '/login',
    redirect: true,
  });

  useEffect(() => {
    if (id) {
      setActiveOrgId(id[0]);
      setActiveProjectId(id[1]);
    }
  }, [id, setActiveOrgId, setActiveProjectId]);

  if (isLoading) return <PageLoader />;
  if (!session?.session.userId) return <ResourceHandler type="unauthorized" />;

  return (
    <Container className="min-h-screen items-center gap-5">
      <AddNewSecrets organizationId={id[0]} projectId={id[1]} userId={session?.session.userId} />
      <AvailableSecrets projectId={id[1]} organizationId={id[0]} userId={session?.session.userId} />
    </Container>
  );
};

export default Project;
