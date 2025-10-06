'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// hooks
import { useTypedQuery } from '@/hooks';
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

// types
import { GetAllAvailableOrganizationsResponse, GetSessionResponse } from '@/types/api/response';

// icons
import { CheckIcon, ChevronsUpDownIcon, Plus } from 'lucide-react';

// components
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SwitchOrgProps {
  activeOrgId: string;
}

export const SwitchOrg: React.FC<SwitchOrgProps> = ({ activeOrgId }) => {
  const router = useRouter();
  const { token } = useCheckAuthClient();
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

  const [open, setOpen] = React.useState(false);

  const organizations = organizationsData?.data?.allOrgs || [];
  const activeOrg = organizations.find((org) => org.id === activeOrgId);

  const handleOrgSwitch = (orgId: string) => {
    if (orgId === activeOrgId) {
      setOpen(false);
      return;
    }

    router.push(`/dashboard/organization/${orgId}/projects`);
    setOpen(false);
  };

  const handleNewOrg = () => {
    router.push('/dashboard/organization/new');
    setOpen(false);
  };

  const handleAllOrgs = () => {
    router.push('/dashboard');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/dashboard/organization/${activeOrgId}/projects`}>{activeOrg?.name}</Link>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            size="sm"
            aria-expanded={open}
            disabled={isOrganizationLoading}
            className="text-muted-foreground"
          >
            <ChevronsUpDownIcon />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search organization..." />
          <CommandList>
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup>
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.name}
                  onSelect={() => handleOrgSwitch(org.id)}
                  className="flex justify-between"
                >
                  <p className="text-sm">{org.name}</p>
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4',
                      activeOrgId === org.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleAllOrgs}>All Organizations</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleNewOrg}>
                <Plus /> New Organization
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
