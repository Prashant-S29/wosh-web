'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// hooks
import { useTypedQuery } from '@/hooks';
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';

// types
import { GetAllAvailableProjectsResponse } from '@/types/api/response';

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

interface SwitchProjectProps {
  activeProjectId: string;
  organizationId: string;
}

export const SwitchProject: React.FC<SwitchProjectProps> = ({
  activeProjectId,
  organizationId,
}) => {
  const router = useRouter();
  const { token } = useCheckAuthClient();

  const { data: projectData, isLoading: isProjectLoading } =
    useTypedQuery<GetAllAvailableProjectsResponse>({
      endpoint: `/api/project/${organizationId}/all?limit=10&page=1`,
      queryKey: ['project', organizationId],
      enabled: !!token && !!organizationId,
    });

  const [open, setOpen] = React.useState(false);

  const projects = projectData?.data?.allProjects || [];
  const activeProject = projects.find((project) => project.id === activeProjectId);

  const handleProjectSwitch = (projectId: string) => {
    if (projectId === activeProjectId) {
      setOpen(false);
      return;
    }

    router.push(`/dashboard/organization/${organizationId}/projects/${projectId}/overview`);
    setOpen(false);
  };

  const handleNewProject = () => {
    router.push(`/dashboard/organization/${organizationId}/projects/new`);
    setOpen(false);
  };

  const handleAllProjects = () => {
    router.push(`/dashboard/organization/${organizationId}/projects`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`/dashboard/organization/${organizationId}/projects/${activeProjectId}/overview`}
        >
          {activeProject?.name}
        </Link>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            size="sm"
            aria-expanded={open}
            disabled={isProjectLoading}
            className="text-muted-foreground"
          >
            <ChevronsUpDownIcon />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search project..." />
          <CommandList>
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  onSelect={() => handleProjectSwitch(project.id)}
                  className="flex justify-between"
                >
                  <p className="text-sm">{project.name}</p>
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4',
                      activeProjectId === project.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleAllProjects}>All Projects</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleNewProject}>
                <Plus /> New Project
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
