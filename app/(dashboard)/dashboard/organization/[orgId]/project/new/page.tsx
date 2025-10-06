'use client';

import React from 'react';
import { useParams } from 'next/navigation';

import { CreateProjectForm } from '@/components/form/project/CreateProjectForm';

const NewProject: React.FC = () => {
  const params = useParams();
  const id = params.orgId as string;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <CreateProjectForm organizationId={id} />
    </div>
  );
};

export default NewProject;
