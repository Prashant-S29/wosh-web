import React from 'react';
import Link from 'next/link';

// utils
import { formatDate, formatNumber } from '@/lib/common';

// types
import { Organization } from '@/types/api/response';

interface OrganizationCardProps {
  data: Organization;
}

export const OrganizationCard: React.FC<OrganizationCardProps> = ({ data }) => {
  return (
    <div>
      <Link href={`/dashboard/organization/${data.id}`}>
        <div className="bg-accent/50 hover:bg-accent/40 relative z-10 flex cursor-pointer flex-col gap-5 rounded-xl border p-5 duration-300">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex aspect-square h-7 items-center justify-center rounded-sm px-2 text-xs font-medium uppercase">
              <p>{data.name.split('-')[0]?.charAt(0)}</p>
            </div>
            <h1 className="line-clamp-1 text-sm font-medium">{data.name}</h1>
          </div>

          {/* <div className="bg-accent h-[150px] w-full rounded-lg" /> */}

          <div className="flex flex-col gap-3 px-1">
            <section>
              <p className="flex items-center justify-between gap-2">
                <span className="text-primary/50 text-sm">Projects</span>
                <span className="text-primary/50 text-sm">{formatNumber(data.totalProjects)}</span>
              </p>
              <p className="mt-1 flex items-center justify-between gap-2">
                <span className="text-primary/50 text-sm">Created At</span>
                <span className="text-primary/50 text-sm">{formatDate(data.createdAt)}</span>
              </p>
            </section>
          </div>
        </div>
      </Link>
    </div>
  );
};
