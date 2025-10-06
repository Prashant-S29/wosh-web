'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';

// icons
import { Terminal } from 'lucide-react';

// components
import { Container, PageLoader, ResourceHandler } from '@/components/common';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// hooks
import { useActiveOrg } from '@/hooks';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

const Activity: React.FC = () => {
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
      <h1 className="text-2xl font-semibold">Activity</h1>
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

export default Activity;
