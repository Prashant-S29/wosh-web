import React from 'react';

// components
import { Button } from '@/components/ui/button';
import { SocialIcons } from '@/public/icons';

export const ContinueWithGoogle: React.FC = () => {
  return (
    <Button variant="outline" className="w-full">
      <SocialIcons.GoogleIcon /> Continue with Google
    </Button>
  );
};
