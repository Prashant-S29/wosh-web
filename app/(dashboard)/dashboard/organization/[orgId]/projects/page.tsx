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
    <Container>
      <h1 className="text-2xl font-semibold">Projects</h1>
      <AvailableProjects organizationId={id} />

      {/* <div className="bg-border my-5 h-[1px] w-full" /> */}
      {/* 
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Alert variant="default">
        <IoWarning />
        <AlertTitle>Delete Project</AlertTitle>
        <AlertDescription>
          You can add components and dependencies to your app using the cli.
        </AlertDescription>
      </Alert> */}
    </Container>
  );
};

export default Organization;
