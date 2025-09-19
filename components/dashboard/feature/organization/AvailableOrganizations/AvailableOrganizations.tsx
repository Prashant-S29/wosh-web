'use client';

import React from 'react';
import Link from 'next/link';

// utils and hooks
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { useTypedQuery } from '@/hooks';

// types
import { GetAllAvailableOrganizationsResponse, GetSessionResponse } from '@/types/api/response';

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
import { CreateOrganizationForm } from '@/components/form/organization';

export const AvailableOrganizations: React.FC = () => {
  const { token } = useCheckAuthClient();

  const { data: sessionData } = useTypedQuery<GetSessionResponse>({
    endpoint: '/api/auth/session',
    queryKey: ['user-session', token],
    enabled: !!token,
  });

  const { data: organizationsData, isLoading: isOrganizationLoading } =
    useTypedQuery<GetAllAvailableOrganizationsResponse>({
      endpoint: `/api/organization/${sessionData?.data?.user?.id}/all?limit=10&page=1`,
      queryKey: ['organizations', token],
      enabled: !!token && !!sessionData?.data?.user?.id,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Continue with</CardTitle>
        <CardDescription>Available organizations</CardDescription>
      </CardHeader>
      <CardContent className="w-[400px]">
        {isOrganizationLoading ? (
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
            {organizationsData?.data?.data.length === 0 ? (
              <div className="bg-accent/50 flex h-[100px] flex-col items-center justify-center rounded-sm">
                <p className="text-muted-foreground text-sm">No organizations found</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {organizationsData?.data?.data.map((data, index) => (
                  <Button
                    key={index}
                    asChild
                    variant="ghost"
                    size="lg"
                    className="w-full justify-between"
                  >
                    <Link href={`/dashboard/organization/${data.id}`}>
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
          trigger={<Button className="w-full">Create Organization</Button>}
          title="Create Organization"
          description="Create a new organization"
          className="w-full max-w-[800px]"
        >
          <CreateOrganizationForm />
        </FormDialogOpener>
      </CardFooter>
    </Card>
  );
};
