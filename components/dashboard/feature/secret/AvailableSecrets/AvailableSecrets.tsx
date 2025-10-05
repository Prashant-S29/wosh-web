'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTypedQuery, useTypedMutation } from '@/hooks';
import {
  DeleteSecretResponse,
  GetAllSecretsResponse,
  Secrets,
  UpdateSecretResponse,
} from '@/types/api/response';
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
  Download,
  Pencil,
  Trash2,
  Save,
} from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMKDFConfig } from '@/hooks/useMKDFConfig';
import { useSecretAuthentication } from '@/hooks/useSecretAuthentication';
import { toast } from 'sonner';
import {
  decryptSecretsArray,
  encryptSecretValue,
  decryptSecretValue,
} from '@/lib/crypto/secret/crypto-utils.secret';
import { UpdateSecretRequestBase } from '@/types/api/request';

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

type OperationType = 'export' | 'edit' | 'copy';

const downloadAsCSV = (
  secrets: Array<{
    key: string;
    value?: string | null | undefined;
    note?: string | null | undefined;
  }>,
) => {
  const csvRows = [
    ['Key', 'Value', 'Note'].join(','),
    ...secrets.map((secret) => {
      const key = `"${(secret.key || '').replace(/"/g, '""')}"`;
      const value = `"${(secret.value || '').replace(/"/g, '""')}"`;
      const note = `"${(secret.note || '').replace(/"/g, '""')}"`;
      return [key, value, note].join(',');
    }),
  ].join('\n');

  const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `secrets_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const downloadAsEnv = (
  secrets: Array<{
    key: string;
    value?: string | null | undefined;
    note?: string | null | undefined;
  }>,
) => {
  const envContent = secrets
    .map((secret) => {
      const lines = [];
      if (secret.note) lines.push(`# ${secret.note}`);
      const value =
        (secret.value || '').includes('\n') || (secret.value || '').includes(' ')
          ? `"${secret.value}"`
          : secret.value || '';
      lines.push(`${secret.key}=${value}`);
      return lines.join('\n');
    })
    .join('\n\n');

  const blob = new Blob([envContent], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `.env.${new Date().toISOString().split('T')[0]}`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const AvailableSecrets: React.FC<AvailableSecretsProps> = ({
  projectId,
  organizationId,
  userId,
}) => {
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

  const { mkdfConfig } = useMKDFConfig({
    organizationId,
    userId,
    enabled: !!userId,
  });

  const { showAuthModal, isAuthenticating, openAuthModal, closeAuthModal, handleAuthentication } =
    useSecretAuthentication<Secrets[] | EditFormData>({
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
    const params = new URLSearchParams();
    params.append('projectId', projectId);
    params.append('page', currentPage.toString());
    params.append('limit', pageSize.toString());
    if (debouncedSearchQuery) {
      params.append('search', debouncedSearchQuery);
    }
    return params.toString();
  };

  const {
    data: allSecrets,
    isLoading,
    isRefetching,
    refetch: refetchSecrets,
  } = useTypedQuery<GetAllSecretsResponse>({
    endpoint: `/api/secret?${buildQueryParams()}`,
    queryKey: ['secret', projectId, currentPage, pageSize, debouncedSearchQuery],
    enabled: !!projectId,
  });

  const deleteMutation = useTypedMutation<unknown, DeleteSecretResponse>({
    endpoint: `/api/secret/${secretToDelete}?projectId=${projectId}`,
    method: 'DELETE',
  });

  const updateMutation = useTypedMutation<UpdateSecretRequestBase, UpdateSecretResponse>({
    endpoint: `/api/secret/${editingRowId}?projectId=${projectId}`,
    method: 'PATCH',
  });

  const handleExport = (format: 'csv' | 'env') => {
    const secrets = allSecrets?.data?.allSecrets || [];
    if (!secrets.length) {
      toast.error('No secrets to export');
      return;
    }
    setExportFormat(format);
    setOperationType('export');
    openAuthModal(secrets);
  };

  // Simply show the edit form without auth
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

  // Validate and open auth modal for encryption
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
    const res = await deleteMutation.mutateAsync({});
    console.log(res);

    if (res.error || !res.data) {
      toast.error('Failed to delete secret');
      return;
    }

    toast.success('Secret deleted successfully');
    refetchSecrets();
    setDeleteDialogOpen(false);
    setSecretToDelete(null);
  };

  const handleCopySecret = (secret: Secrets) => {
    setOperationType('copy');
    // @ts-expect-error - secret
    openAuthModal(secret);
  };

  const onAuthenticationSuccess = async (
    projectKey: Uint8Array,
    data: Secrets[] | EditFormData | Secrets,
  ) => {
    try {
      if (operationType === 'export') {
        const secrets = data as Secrets[];
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
      } else if (operationType === 'edit') {
        const formData = data as EditFormData;

        // Encrypt the new value
        const encryptResult = await encryptSecretValue(formData.value, projectKey, formData.key);

        if (encryptResult.error || !encryptResult.data) {
          toast.error('Failed to encrypt secret value');
          return;
        }

        console.log({
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

        // Update the secret
        const res = await updateMutation.mutateAsync({
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

        console.log(res);
        if (res.error || !res.data) {
          toast.error('Failed to update secret');
          return;
        }

        toast.success('Secret updated successfully');
        refetchSecrets();
        setEditingRowId(null);
        setEditFormData({ secretId: '', key: '', value: '', note: '' });
      } else if (operationType === 'copy') {
        const secret = data as Secrets;

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

        await navigator.clipboard.writeText(decryptResult.data.plaintext);
        toast.success('Secret copied to clipboard');
      }
    } catch (error) {
      console.error('Authentication success handler error:', error);
      toast.error('An error occurred while processing the secret');
    }
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
                  <Button variant="ghost" size="sm" disabled={editingRowId === row.original.id}>
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
    [editingRowId],
  );

  const table = useReactTable({
    data: allSecrets?.data?.allSecrets || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualFiltering: true,
  });

  const pagination = allSecrets?.data?.pagination;

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
          <Button type="button" variant="outline" size="sm" onClick={() => handleExport('env')}>
            <Download className="mr-2 h-4 w-4" />
            Export .env
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
              <Input
                placeholder="Search secrets..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pr-9 pl-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute top-1/2 right-2 h-auto -translate-y-1/2 transform p-1 hover:bg-transparent"
                >
                  <X className="text-muted-foreground h-4 w-4" />
                </Button>
              )}
              {(isLoading || isRefetching) && (
                <div className="absolute top-1/2 right-2 -translate-y-1/2 transform">
                  <div className="border-primary h-4 w-4 animate-spin rounded-full border-1 border-r-transparent" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">Show:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
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
              <Button variant="outline" size="icon" onClick={() => refetchSecrets()}>
                <RefreshCcw />
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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
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
                                disabled={isAuthenticating || updateMutation.isPending}
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
                                disabled={isAuthenticating || updateMutation.isPending}
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
                              disabled={isAuthenticating || updateMutation.isPending}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEdit}
                              disabled={isAuthenticating || updateMutation.isPending}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={isAuthenticating || updateMutation.isPending}
                            >
                              {isAuthenticating || updateMutation.isPending ? (
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
                ))
              ) : (
                <div className="h-24 px-5 py-3 text-center">
                  <p className="text-muted-foreground">
                    {debouncedSearchQuery
                      ? `No secrets match "${debouncedSearchQuery}".`
                      : 'No secrets found.'}
                  </p>
                </div>
              )}
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
                  disabled={!pagination.hasPrev}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
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
                  disabled={!pagination.hasNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.pages)}
                  disabled={!pagination.hasNext}
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

        <SecretAuthModal
          isOpen={showAuthModal}
          onClose={closeAuthModal}
          onAuth={(credentials) =>
            handleAuthentication(credentials.credentials, onAuthenticationSuccess)
          }
          requiresPin={mkdfConfig?.requiresPin ?? false}
          isLoading={isAuthenticating}
          title={
            operationType === 'export'
              ? 'Decrypt Secrets'
              : operationType === 'edit'
                ? 'Authenticate to Save'
                : 'Authenticate to Copy'
          }
          description={
            operationType === 'export'
              ? 'Enter your credentials to decrypt and export secrets.'
              : operationType === 'edit'
                ? 'Enter your credentials to encrypt and save the secret.'
                : 'Enter your credentials to decrypt and copy this secret.'
          }
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the secret from your
                project.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
