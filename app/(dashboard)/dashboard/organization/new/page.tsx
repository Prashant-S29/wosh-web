import React from 'react';

import { CreateOrganizationForm } from '@/components/form/organization';

const NewOrganization: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <CreateOrganizationForm />
    </div>
  );
};

export default NewOrganization;
