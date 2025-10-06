'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

// icons
import { AlertTriangleIcon, Copy } from 'lucide-react';

// components
import { Container, PageLoader, ResourceHandler } from '@/components/common';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// hooks
import { useActiveOrg, useCopyToClipboard, useTypedMutation, useTypedQuery } from '@/hooks';

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
  DeleteOrganizationResponse,
  GetOrganizationResponse,
  UpdateOrganizationResponse,
} from '@/types/api/response';
import { Skeleton } from '@/components/ui/skeleton';
import { UpdateOrganizationRequest } from '@/types/api/request';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const Settings: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { setActiveOrgId } = useActiveOrg();
  const { copyToClipboard } = useCopyToClipboard();

  const id = params.orgId as string;

  const [orgName, setOrgName] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const { isLoading, session } = useCheckAuthClient({
    redirectTo: '/login',
    redirect: true,
  });

  // queries and mutations
  const { data: organizationData, isLoading: isOrganizationLoading } =
    useTypedQuery<GetOrganizationResponse>({
      endpoint: `/api/organization/${id}`,
      queryKey: ['organizations', id],
      enabled: !!id && !isLoading,
    });

  const updateOrganizationMutation = useTypedMutation<
    UpdateOrganizationRequest,
    UpdateOrganizationResponse
  >({
    endpoint: `/api/organization/${id}`,
    method: 'PATCH',
  });

  const deleteOrganizationMutation = useTypedMutation<unknown, DeleteOrganizationResponse>({
    endpoint: `/api/organization/${id}`,
    method: 'DELETE',
  });

  // Set active org and initialize name
  useEffect(() => {
    if (id) {
      setActiveOrgId(id);
    }
  }, [id, setActiveOrgId]);

  useEffect(() => {
    if (organizationData?.data?.name) {
      setOrgName(organizationData.data.name);
    }
  }, [organizationData?.data?.name]);

  const handleNameUpdate = async () => {
    if (orgName.trim()) {
      if (orgName.trim().length < 2 || orgName.trim().length > 200) {
        toast.error('Organization name must be between 2 and 200 characters');
      }
      const res = await updateOrganizationMutation.mutateAsync({ name: orgName.trim() });

      if (res.error || !res.data) {
        toast.error('Failed to update organization name');
        return;
      }

      toast.success('Organization name updated successfully');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    }
  };

  const handleCancelNameUpdate = () => {
    setOrgName(organizationData?.data?.name || '');
  };

  const handleDeleteOrganization = async () => {
    if (deleteConfirmText === 'Confirm Delete') {
      const res = await deleteOrganizationMutation.mutateAsync({});
      if (res.error || !res.data) {
        toast.error('Failed to delete organization');
        return;
      }

      toast.success('Organization deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      router.push('/dashboard');
    }
  };

  const handleCopyPublicKey = () => {
    copyToClipboard(organizationData?.data?.publicKey || '');
    toast.success('Public Key Copied');
  };

  const isNameChanged =
    orgName.trim() !== organizationData?.data?.name?.trim() && orgName.trim() !== '';

  if (isLoading) return <PageLoader />;
  if (!session?.session.userId) return <ResourceHandler type="unauthorized" />;

  return (
    <Container className="gap-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="flex flex-col gap-2">
        <h1 className="text-lg">Organization Details</h1>
        <div className="bg-accent/50 flex flex-col rounded-lg border">
          <div className="flex w-full justify-between border-b p-5">
            <p className="text-sm">Organization Name</p>
            {isOrganizationLoading ? (
              <Skeleton className="h-9 w-[400px]" />
            ) : (
              <Input
                placeholder="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-[400px]"
              />
            )}
          </div>

          <div className="flex w-full items-center justify-between border-b p-5">
            <p className="text-sm">Public Key</p>
            {isOrganizationLoading ? (
              <Skeleton className="h-9 w-[400px]" />
            ) : (
              <div className="relative flex items-center gap-2">
                <Input
                  placeholder="Public Key"
                  className="w-[400px]"
                  disabled
                  value={`${organizationData?.data?.publicKey.slice(0, 20)}.......` || ''}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCopyPublicKey}
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
              disabled={isOrganizationLoading}
              onClick={handleCancelNameUpdate}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                isOrganizationLoading || !isNameChanged || updateOrganizationMutation.isPending
              }
              onClick={handleNameUpdate}
            >
              {updateOrganizationMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-lg">Data Privacy and Encryption</h1>
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-accent/50 flex flex-col justify-between gap-5 rounded-lg border p-5">
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Zero Knowledge</h2>
              <p className="text-muted-foreground text-sm">
                Wosh is built on top of browser based cryptography. All your secrets are encrypted
                in 7 layers completely on your browser. Neither Wosh nor any unauthorized person can
                access your data. No servers are involved in encryption process so even in case of
                full data breach, your secrets are safe.
              </p>
            </section>

            <Button size="sm" variant="secondary" className="w-fit">
              Learn More
            </Button>
          </div>
          <div className="bg-accent/50 flex flex-col justify-between gap-5 rounded-lg border p-5">
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Zero Exposure</h2>
              <p className="text-muted-foreground text-sm">
                When you share your secrets, Wosh CLI will automatically inject them directly into
                the development environment. None of your secrets are exposed to any members of your
                team. Wosh CLI also removes all the memory traces used in decryption process.
              </p>
            </section>

            <Button size="sm" variant="secondary" className="w-fit">
              Learn More
            </Button>
          </div>
          <div />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-lg">Danger Zone</h1>
        <Alert variant="destructive" className="p-5">
          <AlertTriangleIcon />
          <AlertTitle>Deleting this organization will also remove its projects</AlertTitle>
          <AlertDescription>
            <p className="text-muted-foreground">
              Make sure you have made a backup of your projects if you want to keep your data
            </p>
            <div className="mt-5 flex items-center gap-2">
              <Button size="sm" variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
                Delete Organization
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete organization</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the{' '}
              <strong>{organizationData?.data?.name}</strong> organization and remove all of its
              projects.
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
              disabled={
                deleteConfirmText !== 'Confirm Delete' || deleteOrganizationMutation.isPending
              }
              onClick={handleDeleteOrganization}
            >
              {deleteOrganizationMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default Settings;
