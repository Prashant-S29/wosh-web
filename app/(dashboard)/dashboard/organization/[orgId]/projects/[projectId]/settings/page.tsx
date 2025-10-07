'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

// icons
import { AlertTriangleIcon, Copy } from 'lucide-react';

// components
import { Container, PageLoader, ResourceHandler } from '@/components/common';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// hooks
import {
  useActiveOrg,
  useActiveProject,
  useCopyToClipboard,
  useTypedMutation,
  useTypedQuery,
} from '@/hooks';

// utils
import { useCheckAuthClient } from '@/lib/auth/checkAuthClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DeleteProjectResponse,
  GetProjectResponse,
  UpdateProjectResponse,
} from '@/types/api/response';
import { Skeleton } from '@/components/ui/skeleton';
import { UpdateProjectRequest } from '@/types/api/request';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const Settings: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { setActiveOrgId } = useActiveOrg();
  const { setActiveProjectId } = useActiveProject();
  const { copyToClipboard } = useCopyToClipboard();

  const id = useMemo(
    () => [params.orgId, params.projectId] as string[],
    [params.orgId, params.projectId],
  );

  const [projectName, setProjectName] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { isLoading, session } = useCheckAuthClient({
    redirectTo: '/login',
    redirect: true,
  });

  // queries and mutations
  const { data: projectData, isLoading: isProjectLoading } = useTypedQuery<GetProjectResponse>({
    endpoint: `/api/project/${id[0]}/${id[1]}`,
    queryKey: ['project', id[0], id[1]],
    enabled: !!id[0] && !!id[1] && !isLoading,
  });

  const updateProjectMutation = useTypedMutation<UpdateProjectRequest, UpdateProjectResponse>({
    endpoint: `/api/project/${id[0]}/${id[1]}`,
    method: 'PATCH',
  });

  const deleteProjectMutation = useTypedMutation<unknown, DeleteProjectResponse>({
    endpoint: `/api/project/${id[0]}/${id[1]}`,
    method: 'DELETE',
  });

  // Set active org and project, initialize name
  useEffect(() => {
    if (id[0] && id[1]) {
      setActiveOrgId(id[0]);
      setActiveProjectId(id[1]);
    }
  }, [id, setActiveOrgId, setActiveProjectId]);

  useEffect(() => {
    if (projectData?.data?.name) {
      setProjectName(projectData.data.name);
    }
  }, [projectData?.data?.name]);

  const handleNameUpdate = async () => {
    if (projectName.trim()) {
      if (projectName.trim().length < 2 || projectName.trim().length > 200) {
        toast.error('Project name must be between 2 and 200 characters');
        return;
      }
      const res = await updateProjectMutation.mutateAsync({ name: projectName.trim() });

      if (res.error || !res.data) {
        toast.error('Failed to update project name');
        return;
      }

      toast.success('Project name updated successfully');
      queryClient.invalidateQueries({ queryKey: ['project'] });
    }
  };

  const handleCancelNameUpdate = () => {
    setProjectName(projectData?.data?.name || '');
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmText === 'Confirm Delete') {
      const res = await deleteProjectMutation.mutateAsync({});
      if (res.error || !res.data) {
        toast.error('Failed to delete project');
        return;
      }

      toast.success('Project deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['project'] });
      router.push(`/dashboard/organization/${id[0]}/projects`);
    }
  };

  const isNameChanged =
    projectName.trim() !== projectData?.data?.name?.trim() && projectName.trim() !== '';

  if (isLoading) return <PageLoader />;
  if (!session?.session.userId) return <ResourceHandler type="unauthorized" />;

  return (
    <Container className="gap-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="flex flex-col gap-2">
        <h1 className="text-lg">Project Details</h1>
        <div className="bg-accent/50 flex flex-col rounded-lg border">
          <div className="flex w-full justify-between border-b p-5">
            <p className="text-sm">Project Name</p>
            {isProjectLoading ? (
              <Skeleton className="h-9 w-[400px]" />
            ) : (
              <Input
                placeholder="Project Name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-[400px]"
              />
            )}
          </div>

          <div className="flex w-full items-center justify-between border-b p-5">
            <p className="text-sm">Project ID</p>
            {isProjectLoading ? (
              <Skeleton className="h-9 w-[400px]" />
            ) : (
              <div className="relative flex items-center gap-2">
                <Input
                  placeholder="Project ID"
                  className="w-[400px]"
                  disabled
                  value={projectData?.data?.id || ''}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    copyToClipboard(projectData?.data?.id || '');
                    toast.success('Project ID Copied');
                  }}
                  className="absolute right-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex w-full justify-end gap-4 border-b p-5">
            <Button
              size="sm"
              variant="secondary"
              disabled={isProjectLoading}
              onClick={handleCancelNameUpdate}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isProjectLoading || !isNameChanged || updateProjectMutation.isPending}
              onClick={handleNameUpdate}
            >
              {updateProjectMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-lg">Danger Zone</h1>
        <Alert variant="destructive" className="p-5">
          <AlertTriangleIcon />
          <AlertTitle>Deleting this project will remove all its data</AlertTitle>
          <AlertDescription>
            <p className="text-muted-foreground">
              Make sure you have made a backup of your data if you want to keep it
            </p>
            <div className="mt-5 flex items-center gap-2">
              <Button size="sm" variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                Delete Project
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the{' '}
              <strong>{projectData?.data?.name}</strong> project and remove all of its data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                Please type <strong>Confirm Delete</strong> to confirm
              </p>
              <Input
                placeholder="Confirm Delete"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== 'Confirm Delete' || deleteProjectMutation.isPending}
              onClick={handleDeleteProject}
            >
              {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default Settings;
