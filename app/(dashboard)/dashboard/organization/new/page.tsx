import React from 'react';

import { CreateOrganizationForm } from '@/components/form/organization';
import { Container } from '@/components/common';

const NewOrganization: React.FC = () => {
  return (
    <Container className="items-center">
      <CreateOrganizationForm />
    </Container>
  );
};

export default NewOrganization;
