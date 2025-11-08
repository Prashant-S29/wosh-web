'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  MoreHorizontal,
  RefreshCcw,
  Copy,
  Pencil,
  Trash2,
  Save,
  ChevronDown,
} from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table';
import { toast } from 'sonner';

// hooks
import { useMKDFConfig } from '@/hooks/useMKDFConfig';
import { useTypedQuery, useTypedMutation, useCopyToClipboard } from '@/hooks';
import { useSecretAuthentication } from '@/hooks/useSecretAuthentication';

// utils
import {
  decryptSecretsArray,
  encryptSecretValue,
  decryptSecretValue,
} from '@/lib/crypto/secret/crypto-utils.secret';
import { downloadAsCSV, downloadAsEnv } from '@/lib/secrets';
import { generateShareTokenAndCode, getShareUrl } from '@/lib/crypto/secret';

// types
import {
  DeleteSecretResponse,
  GetAllSecretsResponse,
  // GetSecretSharingCodeResponse,
  Secrets,
  ShareSecretResponse,
  UpdateSecretResponse,
} from '@/types/api/response';
import { ShareSecretRequest, UpdateSecretRequestBase } from '@/types/api/request';

// components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SecretAuthModal } from '@/components/common';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SecretsDeleteDialog } from './SecretsDeleteDialog';
import { ShareSecretDialog } from './ShareSecretDialog';
import { useQueryClient } from '@tanstack/react-query';

const columnHelper = createColumnHelper<Secrets>();

interface AvailableSecretsProps {
  projectId: string;
  organizationId: string;
  userId: string;
}

interface EditFormData {
  secretId: string;
  key: string;
  value: string;
  note: string;
}

type OperationType = 'export' | 'edit' | 'copy' | 'share';

export const AvailableSecrets: React.FC<AvailableSecretsProps> = ({
  projectId,
  organizationId,
  userId,
}) => {
  const { copyToClipboard } = useCopyToClipboard();
  const queryClient = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'env'>('env');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    secretId: '',
    key: '',
    value: '',
    note: '',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [secretToDelete, setSecretToDelete] = useState<string | null>(null);
  const [operationType, setOperationType] = useState<OperationType>('export');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');

  const { mkdfConfig } = useMKDFConfig({
    organizationId,
    userId,
    enabled: !!userId,
  });

  const { showAuthModal, isAuthenticating, openAuthModal, closeAuthModal, handleAuthentication } =
    useSecretAuthentication<
      Secrets[] | EditFormData | Secrets | { organizationId: string; projectId: string }
    >({
      projectId,
      organizationId,
      userId,
    });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const buildQueryParams = () => {
    const params = new URLSearchParams({
      projectId,
      page: currentPage.toString(),
      limit: pageSize.toString(),
    });

    if (debouncedSearchQuery) {
      params.append('search', debouncedSearchQuery);
    }

    return params.toString();
  };

  const {
    data: allSecrets,
    isLoading: isLoadingSecrets,
    isRefetching: isRefetchingSecrets,
    refetch: refetchSecrets,
  } = useTypedQuery<GetAllSecretsResponse>({
    endpoint: `/api/secret?${buildQueryParams()}`,
    queryKey: ['secret', projectId, currentPage, pageSize, debouncedSearchQuery],
    enabled: !!projectId,
  });

  // const { data: secretSharingCodeData } = useTypedQuery<GetSecretSharingCodeResponse>({
  //   endpoint: `/api/project/${organizationId}/${projectId}/secret-sharing-code`,
  //   queryKey: ['secret-sharing-code', projectId],
  //   enabled: !!projectId,
  // });

  const { mutateAsync: deleteSecret, isPending: isDeletingSecret } = useTypedMutation<
    unknown,
    DeleteSecretResponse
  >({
    endpoint: `/api/secret/${secretToDelete}?projectId=${projectId}`,
    method: 'DELETE',
  });

  const { mutateAsync: updateSecret, isPending: isUpdatingSecret } = useTypedMutation<
    UpdateSecretRequestBase,
    UpdateSecretResponse
  >({
    endpoint: `/api/secret/${editingRowId}?projectId=${projectId}`,
    method: 'PATCH',
  });

  const { mutateAsync: shareSecret } = useTypedMutation<
    ShareSecretRequest,
    ShareSecretResponse
  >({
    endpoint: `/api/project/${organizationId}/${projectId}/share`,
    method: 'POST',
  });

  const secrets = allSecrets?.data?.allSecrets || [];
  const pagination = allSecrets?.data?.pagination;
  const hasSecrets = secrets.length > 0;
  const isLoadingData = isLoadingSecrets || isRefetchingSecrets;
  // const existingSharingCode = secretSharingCodeData?.data?.secretSharingCode;

  const handleExport = (format: 'csv' | 'env') => {
    if (!hasSecrets) {
      toast.error('No secrets to export');
      return;
    }
    setExportFormat(format);
    setOperationType('export');
    openAuthModal(secrets);
  };

  const handleEditClick = (secret: Secrets) => {
    setEditingRowId(secret.id);
    setEditFormData({
      secretId: secret.id,
      key: secret.keyName,
      value: '',
      note: secret.note || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditFormData({ secretId: '', key: '', value: '', note: '' });
  };

  const handleSaveEdit = () => {
    if (!editFormData.key.trim()) {
      toast.error('Key name cannot be empty');
      return;
    }
    if (!editFormData.value.trim()) {
      toast.error('Value cannot be empty');
      return;
    }

    setOperationType('edit');
    openAuthModal(editFormData);
  };

  const handleDeleteClick = (secretId: string) => {
    setSecretToDelete(secretId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!secretToDelete) return;

    try {
      const res = await deleteSecret({});

      if (res.error || !res.data) {
        toast.error('Failed to delete secret');
        return;
      }

      toast.success('Secret deleted successfully');
      refetchSecrets();
      setDeleteDialogOpen(false);
      setSecretToDelete(null);
    } catch (error) {
      console.error('Failed to delete secret:', error);
      toast.error('Failed to delete secret');
    }
  };

  const handleCopySecret = (secret: Secrets) => {
    setOperationType('copy');
    openAuthModal(secret);
  };

  // const handleShare = async () => {
  //   if (existingSharingCode) {
  //     const url = await getShareUrl(existingSharingCode);
  //     setShareUrl(url);
  //     setShareDialogOpen(true);
  //     return;
  //   }

  //   setOperationType('share');
  //   openAuthModal({ organizationId, projectId });
  // };

  const onAuthenticationSuccess = async (
    projectKey: Uint8Array,
    data: Secrets[] | EditFormData | Secrets | { organizationId: string; projectId: string },
  ) => {
    try {
      if (operationType === 'export') {
        await handleExportOperation(data as Secrets[], projectKey);
      } else if (operationType === 'edit') {
        await handleEditOperation(data as EditFormData, projectKey);
      } else if (operationType === 'copy') {
        await handleCopyOperation(data as Secrets, projectKey);
      } else if (operationType === 'share') {
        await handleShareOperation();
      }
    } catch (error) {
      console.error('Authentication success handler error:', error);
      toast.error('An error occurred while processing the secret');
    }
  };

  const handleExportOperation = async (secrets: Secrets[], projectKey: Uint8Array) => {
    if (!secrets.length) {
      toast.error('No secrets to decrypt');
      return;
    }

    const decryptResult = await decryptSecretsArray({
      encryptedSecrets: secrets,
      projectKey,
    });

    if (decryptResult.error || !decryptResult.data) {
      toast.error(decryptResult.message || 'Failed to decrypt secrets');
      return;
    }

    if (exportFormat === 'csv') {
      downloadAsCSV(decryptResult.data);
      toast.success(`Exported ${decryptResult.data.length} secrets as CSV`);
    } else {
      downloadAsEnv(decryptResult.data);
      toast.success(`Exported ${decryptResult.data.length} secrets as .env file`);
    }
  };

  const handleEditOperation = async (formData: EditFormData, projectKey: Uint8Array) => {
    const encryptResult = await encryptSecretValue(formData.value, projectKey, formData.key);

    if (encryptResult.error || !encryptResult.data) {
      toast.error('Failed to encrypt secret value');
      return;
    }

    const res = await updateSecret({
      keyName: formData.key,
      ciphertext: encryptResult.data.ciphertext,
      nonce: encryptResult.data.nonce,
      note: formData.note,
      metadata: {
        algorithm: 'aes-256-gcm',
        version: 1,
        isEmpty: false,
      },
    });

    if (res.error || !res.data) {
      toast.error('Failed to update secret');
      return;
    }

    toast.success('Secret updated successfully');
    refetchSecrets();
    setEditingRowId(null);
    setEditFormData({ secretId: '', key: '', value: '', note: '' });
  };

  const handleCopyOperation = async (secret: Secrets, projectKey: Uint8Array) => {
    if (secret.metadata.isEmpty) {
      toast.info('Secret is empty');
      return;
    }

    const decryptResult = await decryptSecretValue({
      encryptedSecret: {
        ciphertext: secret.ciphertext,
        nonce: secret.nonce,
      },
      projectKey,
      keyName: secret.keyName,
    });

    if (decryptResult.error || !decryptResult.data) {
      toast.error('Failed to decrypt secret');
      return;
    }

    await copyToClipboard(decryptResult.data.plaintext);
    toast.success('Secret copied to clipboard');
  };

  const handleShareOperation = async () => {
    const generateShareTokenAndCodeRes = await generateShareTokenAndCode({
      orgId: organizationId,
      projectId: projectId,
    });

    if (
      generateShareTokenAndCodeRes.error ||
      !generateShareTokenAndCodeRes.data?.token ||
      !generateShareTokenAndCodeRes.data?.code
    ) {
      toast.error('Failed to generate share token and code');
      return;
    }

    const res = await shareSecret({
      secretSharingToken: generateShareTokenAndCodeRes.data.token,
      secretSharingCode: generateShareTokenAndCodeRes.data.code,
    });

    if (res.error || !res.data?.id) {
      toast.error('Failed to save token');
      return;
    }

    const url = await getShareUrl(generateShareTokenAndCodeRes.data.code);
    setShareUrl(url);

    // Reset the query cache for the secret sharing code
    queryClient.invalidateQueries({ queryKey: ['secret-sharing-code', projectId] });
    setShareDialogOpen(true);
    toast.success('Share link generated successfully');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('keyName', {
        header: 'Key Name',
        cell: ({ row }) => {
          return <p className="font-mono font-medium">{row.getValue('keyName')}</p>;
        },
      }),
      columnHelper.accessor('ciphertext', {
        header: 'Value',
        cell: ({ row }) => {
          const secret = row.original;
          const isEmpty = secret.metadata.isEmpty;

          if (isEmpty) {
            return <div className="text-muted-foreground italic">Empty</div>;
          }

          return (
            <div className="relative flex w-fit items-center gap-2">
              <span className="text-muted-foreground font-mono text-sm">••••••••</span>
              {!isEmpty && (
                <Button
                  variant="ghost"
                  size="icon"
                  tabIndex={-1}
                  className="absolute -right-12 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  onClick={() => handleCopySecret(secret)}
                  disabled={isAuthenticating}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('updatedAt', {
        header: '',
        cell: ({ row }) => {
          return (
            <div className="flex items-center justify-end gap-2">
              <p className="text-muted-foreground">{formatDate(row.getValue('updatedAt'))}</p>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={editingRowId === row.original.id || isAuthenticating}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleEditClick(row.original)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleDeleteClick(row.original.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingRowId, isAuthenticating],
  );

  const table = useReactTable({
    data: secrets,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualFiltering: true,
  });

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: string) => {
    const size = newPageSize === 'all' ? pagination?.total || 1000 : parseInt(newPageSize);
    setPageSize(size);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const isEditFormValid = editFormData.value.length > 0 && editFormData.key.length > 0;
  const isProcessing = isAuthenticating || isUpdatingSecret;

  return (
    <Card className="w-full max-w-5xl">
      <CardHeader className="flex items-start justify-between">
        <div>
          <CardTitle>All Secrets</CardTitle>
          <CardDescription className="mt-2">
            All available secrets in your project.
            {pagination && (
              <span className="ml-2">
                ({pagination.total} total secret{pagination.total !== 1 ? 's' : ''})
              </span>
            )}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasSecrets || isAuthenticating}
              >
                Export
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('env')}>
                Export as .env
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>Export as CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* <Button
            type="button"
            size="sm"
            onClick={handleShare}
            loading={isSharingSecret}
            disabled={
              isAuthenticating || isLoadingSecretSharingCode || isSharingSecret || !hasSecrets
            }
          >
            Share
          </Button> */}
        </div>
      </CardHeader>
      <CardContent>
        {hasSecrets ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search secrets..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pr-9 pl-9"
                  disabled={isAuthenticating}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="absolute top-1/2 right-2 h-auto -translate-y-1/2 transform p-1 hover:bg-transparent"
                    disabled={isAuthenticating}
                  >
                    <X className="text-muted-foreground h-4 w-4" />
                  </Button>
                )}
                {isLoadingData && (
                  <div className="absolute top-1/2 right-2 -translate-y-1/2 transform">
                    <div className="border-primary h-4 w-4 animate-spin rounded-full border-1 border-r-transparent" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Show:</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={handlePageSizeChange}
                    disabled={isAuthenticating}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="all">All Rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetchSecrets()}
                  disabled={isLoadingData || isAuthenticating}
                >
                  <RefreshCcw className={isLoadingData ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>

            {debouncedSearchQuery && (
              <div className="bg-muted flex items-center gap-2 rounded-lg p-3">
                <Search className="text-muted-foreground h-4 w-4" />
                <span className="text-sm">
                  Searching for: <strong>{debouncedSearchQuery}</strong>
                </span>
                {pagination && (
                  <span className="text-muted-foreground text-sm">
                    ({pagination.total} result{pagination.total !== 1 ? 's' : ''} found)
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="ml-auto h-auto p-1"
                  disabled={isAuthenticating}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <div className="border-b px-5 py-3 text-sm font-medium">
                {table.getHeaderGroups().map((headerGroup) => (
                  <div key={headerGroup.id} className="grid min-w-fit grid-cols-3 gap-5">
                    {headerGroup.headers.map((header) => (
                      <p key={header.id} className="font-semibold">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </p>
                    ))}
                  </div>
                ))}
              </div>

              <div>
                {table.getRowModel().rows.map((row) => (
                  <div key={row.id} className="border-b last-of-type:border-none">
                    <div className="group grid min-w-fit grid-cols-3 items-center gap-5 px-5 py-3 text-sm transition-colors">
                      {row
                        .getVisibleCells()
                        .slice(0, columns.length - 1)
                        .map((cell) => (
                          <div key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        ))}

                      <div className="float-end">
                        {flexRender(
                          row.getVisibleCells()[columns.length - 1].column.columnDef.cell,
                          row.getVisibleCells()[columns.length - 1].getContext(),
                        )}
                      </div>
                    </div>

                    {editingRowId === row.original.id && (
                      <div className="bg-muted/30 border-t px-5 py-4">
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Key Name</label>
                              <Input
                                value={editFormData.key}
                                onChange={(e) =>
                                  setEditFormData({ ...editFormData, key: e.target.value })
                                }
                                placeholder="KEY_NAME"
                                className="mt-2 font-mono"
                                disabled={isProcessing}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Value (New)</label>
                              <Input
                                type="password"
                                value={editFormData.value}
                                onChange={(e) =>
                                  setEditFormData({ ...editFormData, value: e.target.value })
                                }
                                placeholder="Enter new secret value"
                                className="mt-2 font-mono"
                                disabled={isProcessing}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Note (Optional)</label>
                            <Textarea
                              value={editFormData.note}
                              onChange={(e) =>
                                setEditFormData({ ...editFormData, note: e.target.value })
                              }
                              placeholder="Add a note about this secret..."
                              rows={2}
                              className="mt-2"
                              disabled={isProcessing}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEdit}
                              disabled={isProcessing}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={isProcessing || !isEditFormValid}
                            >
                              {isProcessing ? (
                                <>
                                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="mr-2 h-4 w-4" />
                                  Save Changes
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} results
                  {debouncedSearchQuery && <span className="ml-1">for {debouncedSearchQuery}</span>}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={!pagination.hasPrev || isAuthenticating}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrev || isAuthenticating}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <span className="px-3 text-sm font-medium">
                    Page {pagination.page} of {pagination.pages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNext || isAuthenticating}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.pages)}
                    disabled={!pagination.hasNext || isAuthenticating}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {pagination && pagination.pages <= 1 && pagination.total > 0 && (
              <div className="text-muted-foreground text-center text-sm">
                Showing all {pagination.total} result{pagination.total !== 1 ? 's' : ''}
                {debouncedSearchQuery && <span className="ml-1">for {debouncedSearchQuery}</span>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center px-5 py-3 text-center">
            <p className="text-muted-foreground">
              {debouncedSearchQuery
                ? `No secrets match "${debouncedSearchQuery}".`
                : 'No secrets found.'}
            </p>
          </div>
        )}

        <SecretAuthModal
          isOpen={showAuthModal}
          onClose={closeAuthModal}
          onAuth={(credentials) =>
            handleAuthentication(credentials.credentials, (projectKey, data) =>
              onAuthenticationSuccess(projectKey, data),
            )
          }
          requiresPin={mkdfConfig?.requiresPin ?? false}
          isLoading={isAuthenticating}
          title={
            operationType === 'export'
              ? 'Decrypt Secrets'
              : operationType === 'edit'
                ? 'Authenticate to Save'
                : operationType === 'share'
                  ? 'Authenticate to Share'
                  : 'Authenticate to Copy'
          }
          description={
            operationType === 'export'
              ? 'Enter your credentials to decrypt and export secrets.'
              : operationType === 'edit'
                ? 'Enter your credentials to encrypt and save the secret.'
                : operationType === 'share'
                  ? 'Enter your credentials to generate a secure share link.'
                  : 'Enter your credentials to decrypt and copy this secret.'
          }
        />

        <SecretsDeleteDialog
          deleteDialogOpen={deleteDialogOpen}
          setDeleteDialogOpen={setDeleteDialogOpen}
          handleConfirmDelete={handleConfirmDelete}
          isPending={isDeletingSecret}
        />

        <ShareSecretDialog
          setShareDialogOpen={setShareDialogOpen}
          shareDialogOpen={shareDialogOpen}
          shareUrl={shareUrl}
        />
      </CardContent>
    </Card>
  );
};
