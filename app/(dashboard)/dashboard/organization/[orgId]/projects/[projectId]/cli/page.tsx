'use client';

import React, { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';


// components
import { Container, PageLoader, ResourceHandler } from '@/components/common';

// hooks
import { useActiveOrg, useActiveProject } from '@/hooks';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { Button } from '@/components/ui/button';

const CLI: React.FC = () => {
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
    <Container className="gap-8">
      <h1 className="text-2xl font-semibold">CLI Integration</h1>
      <div className="flex flex-col gap-2">
        <h1 className="text-lg">Token and Access Control</h1>
        <div className="bg-accent/50 flex flex-col rounded-lg border">
          <div className="flex w-full items-center justify-between p-5">
            <p className="text-sm">CLI Token</p>
            <Button size="sm" variant="secondary">
              Generate
            </Button>
          </div>
        </div>
      </div>
    </Container>
  );
};

export default CLI;
