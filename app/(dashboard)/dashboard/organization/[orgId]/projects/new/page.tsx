'use client';

import React from 'react';
import { useParams } from 'next/navigation';

import { CreateProjectForm } from '@/components/form/project/CreateProjectForm';
import { Container } from '@/components/common';

const NewProject: React.FC = () => {
  const params = useParams();
  const id = params.orgId as string;

  return (
    <Container className="flex min-h-screen flex-col items-center">
      <CreateProjectForm organizationId={id} />
    </Container>
  );
};

export default NewProject;
