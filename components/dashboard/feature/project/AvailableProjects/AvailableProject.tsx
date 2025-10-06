'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

// utils and hooks
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { useTypedQuery } from '@/hooks';

// types
import { GetAllAvailableProjectsResponse } from '@/types/api/response';

// components
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FolderOpen, Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ProjectsCard } from '../ProjectsCard';

interface AvailableProjectsProps {
  organizationId: string;
}

export const AvailableProjects: React.FC<AvailableProjectsProps> = ({ organizationId }) => {
  const { token } = useCheckAuthClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: projectData, isLoading: isProjectLoading } =
    useTypedQuery<GetAllAvailableProjectsResponse>({
      endpoint: `/api/project/${organizationId}/all?limit=10&page=1`,
      queryKey: ['project', organizationId],
      enabled: !!token && !!organizationId,
    });

  const filteredProjects = useMemo(() => {
    if (!projectData?.data?.allProjects) return [];

    if (!searchQuery.trim()) {
      return projectData.data.allProjects;
    }

    return projectData.data.allProjects.filter((project) =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [projectData?.data?.allProjects, searchQuery]);

  return (
    <div>
      {isProjectLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[100px] w-full" />
          ))}
        </div>
      ) : (
        <>
          {projectData?.data?.allProjects.length === 0 ? (
            <Empty className="bg-accent/50 gap-1 border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderOpen />
                </EmptyMedia>
              </EmptyHeader>
              <EmptyTitle>No Projects found</EmptyTitle>
              <EmptyDescription>Create your first Project to get started.</EmptyDescription>
              <EmptyContent className="mt-4">
                <Button size="sm" asChild>
                  <Link href={`/dashboard/organization/${organizationId}/project/new`}>
                    <Plus />
                    New Project
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="relative max-w-sm flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Button size="sm" asChild>
                  <Link href={`/dashboard/organization/${organizationId}/project/new`}>
                    <Plus />
                    New Project
                  </Link>
                </Button>
              </div>

              {filteredProjects.length === 0 ? (
                <Empty className="bg-accent/50 gap-1 border border-dashed">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Search />
                    </EmptyMedia>
                  </EmptyHeader>
                  <EmptyTitle>No projects found</EmptyTitle>
                  <EmptyDescription>
                    No projects match your search criteria. Try a different search term.
                  </EmptyDescription>
                </Empty>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {filteredProjects.map((data) => (
                    <ProjectsCard data={data} key={data.id} organizationId={organizationId} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
