'use client';

import React from 'react';
import Link from 'next/link';

// utils and hooks
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { useTypedQuery } from '@/hooks';

// types
import { GetAllAvailableProjectsResponse } from '@/types/api/response';

// icons
import { ChevronRightIcon } from 'lucide-react';

// components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FormDialogOpener } from '@/components/common';
import { Button } from '@/components/ui/button';
import { CreateProjectForm } from '@/components/form/project/CreateProjectForm';

interface AvailableProjectsProps {
  organizationId: string;
}

export const AvailableProjects: React.FC<AvailableProjectsProps> = ({ organizationId }) => {
  const { token } = useCheckAuthClient();

  const { data: projectData, isLoading: isProjectLoading } =
    useTypedQuery<GetAllAvailableProjectsResponse>({
      endpoint: `/api/project/${organizationId}/all?limit=10&page=1`,
      queryKey: ['project', organizationId],
      enabled: !!token && !!organizationId,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Continue with</CardTitle>
        <CardDescription>Available Projects</CardDescription>
      </CardHeader>
      <CardContent className="w-[400px]">
        {isProjectLoading ? (
          <div className="flex flex-col">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={index}
                className="hover:bg-accent/20 flex cursor-pointer items-center justify-between border-b px-3 py-4 last-of-type:border-none"
              >
                <Skeleton className="h-8 w-[200px]" />
                <ChevronRightIcon size={16} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {projectData?.data?.allProjects.length === 0 ? (
              <div className="bg-accent/50 flex h-[100px] flex-col items-center justify-center rounded-sm">
                <p className="text-muted-foreground text-sm">No projects found</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {projectData?.data?.allProjects.map((data, index) => (
                  <Button
                    key={index}
                    asChild
                    variant="ghost"
                    size="lg"
                    className="w-full justify-between"
                  >
                    <Link href={`/dashboard/organization/${organizationId}/project/${data.id}`}>
                      <p className="text-sm">{data.name}</p>
                      <ChevronRightIcon size={16} />
                    </Link>
                  </Button>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <CardFooter>
        <FormDialogOpener
          trigger={<Button className="w-full">Create Project</Button>}
          title="Create Project"
          description="Create a new project"
          className="w-full max-w-[800px]"
        >
          <CreateProjectForm organizationId={organizationId} />
        </FormDialogOpener>
      </CardFooter>
    </Card>
  );
};
