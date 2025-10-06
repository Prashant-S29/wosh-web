'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

// utils and hooks
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { useTypedQuery } from '@/hooks';

// types
import { GetAllAvailableOrganizationsResponse, GetSessionResponse } from '@/types/api/response';

// icons
import { FolderOpen, Plus, Search } from 'lucide-react';

// components
import { Skeleton } from '@/components/ui/skeleton';
import { OrganizationCard } from '../OrganizationCard';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const AvailableOrganizations: React.FC = () => {
  const { token } = useCheckAuthClient();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: sessionData } = useTypedQuery<GetSessionResponse>({
    endpoint: '/api/auth/session',
    queryKey: ['user-session', token],
    enabled: !!token,
  });

  const { data: organizationsData, isLoading: isOrganizationLoading } =
    useTypedQuery<GetAllAvailableOrganizationsResponse>({
      endpoint: `/api/organization/${sessionData?.data?.user?.id}/all`,
      queryKey: ['organizations', token],
      enabled: !!token && !!sessionData?.data?.user?.id,
    });

  // Filter organizations based on search query
  const filteredOrganizations = useMemo(() => {
    if (!organizationsData?.data?.allOrgs) return [];

    if (!searchQuery.trim()) {
      return organizationsData.data.allOrgs;
    }

    return organizationsData.data.allOrgs.filter((org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [organizationsData?.data?.allOrgs, searchQuery]);

  return (
    <div>
      {isOrganizationLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[100px] w-full" />
          ))}
        </div>
      ) : (
        <>
          {organizationsData?.data?.allOrgs.length === 0 ? (
            <Empty className="bg-accent/50 gap-1 border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderOpen />
                </EmptyMedia>
              </EmptyHeader>
              <EmptyTitle>No organizations found</EmptyTitle>
              <EmptyDescription>Create your first organization to get started.</EmptyDescription>
              <EmptyContent className="mt-4">
                <Button size="sm" asChild>
                  <Link href="/dashboard/organization/new">
                    <Plus />
                    New Organization
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
                    placeholder="Search organizations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button size="sm" asChild>
                  <Link href="/dashboard/organization/new">
                    <Plus />
                    New Organization
                  </Link>
                </Button>
              </div>

              {filteredOrganizations.length === 0 ? (
                <Empty className="bg-accent/50 gap-1 border border-dashed">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Search />
                    </EmptyMedia>
                  </EmptyHeader>
                  <EmptyTitle>No organizations found</EmptyTitle>
                  <EmptyDescription>
                    No organizations match your search criteria. Try a different search term.
                  </EmptyDescription>
                </Empty>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {filteredOrganizations.map((data) => (
                    <OrganizationCard data={data} key={data.id} />
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
