import React from 'react';
import { orgHeaderData } from './data';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface OrgHeaderProps {
  orgId: string;
  pathName: string;
}

export const OrgHeader: React.FC<OrgHeaderProps> = ({ orgId, pathName }) => {
  return (
    <div className="flex px-8 pt-2">
      {orgHeaderData.map((item, index) => (
        <Button
          key={index}
          asChild
          variant="ghost"
          className={`relative ${pathName.includes(item.href) ? 'text-primary' : 'text-muted-foreground'}`}
        >
          <Link href={`/dashboard/organization/${orgId}/${item.href}`}>
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
