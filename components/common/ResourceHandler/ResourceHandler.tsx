import React from 'react';

interface ResourceHandlerProps {
  type: 'unauthorized' | 'notFound';
}
export const ResourceHandler: React.FC<ResourceHandlerProps> = ({ type }) => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      {type === 'unauthorized' && <p>You are not authorized to access this resource</p>}
      {type === 'notFound' && <p>Resource not found</p>}
    </div>
  );
};
