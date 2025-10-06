import { formatDate } from '@/lib/common';
import { Project } from '@/types/api/response';
import Link from 'next/link';
import React from 'react';

interface ProjectsCardProps {
  data: Project;
  organizationId: string;
}

export const ProjectsCard: React.FC<ProjectsCardProps> = ({ data, organizationId }) => {
  return (
    <div>
      <Link href={`/dashboard/organization/${organizationId}/projects/${data.id}`}>
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
