'use client';

import React, { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';

// icons
import { Terminal } from 'lucide-react';

// components
import { Container, PageLoader, ResourceHandler } from '@/components/common';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// hooks
import { useActiveOrg, useActiveProject } from '@/hooks';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

const Logs: React.FC = () => {
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
    <Container>
      <h1 className="text-2xl font-semibold">Logs</h1>
      <Alert variant="default">
        <Terminal />
        <AlertTitle>Coming Soon</AlertTitle>
        <AlertDescription>
          This feature is currently under development. Come back soon!
        </AlertDescription>
      </Alert>
    </Container>
  );
};

export default Logs;
