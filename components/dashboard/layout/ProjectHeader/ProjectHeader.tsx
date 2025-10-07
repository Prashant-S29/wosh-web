import React from 'react';
import { projectHeaderData } from './data';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ProjectHeader {
  orgId: string;
  projectId: string;
  pathName: string;
}

export const ProjectHeader: React.FC<ProjectHeader> = ({ orgId, projectId, pathName }) => {
  return (
    <div className="flex px-8 pt-2">
      {projectHeaderData.map((item, index) => (
        <Button
          key={index}
          asChild
          variant="ghost"
          className={`relative ${pathName.includes(item.href) ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Link href={`/dashboard/organization/${orgId}/projects/${projectId}/${item.href}`}>
            {pathName.includes(item.href) && (
              <div className="bg-primary absolute bottom-0 left-0 h-[1px] w-full" />
            )}
            {item.label}
          </Link>
        </Button>
      ))}
    </div>
  );
};
