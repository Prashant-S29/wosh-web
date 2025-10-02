import React, { useState, useMemo, useEffect } from 'react';

// hooks
import { useTypedQuery } from '@/hooks';

// types
import { GetAllSecretsResponse, Secrets } from '@/types/api/response';

// icons
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
} from 'lucide-react';

// components
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Skeleton } from '@/components/ui/skeleton';
import { SecretAuthModal } from '@/components/common';

// hooks
import { useMKDFConfig } from '@/hooks/useMKDFConfig';
import { useSecretAuthentication } from '@/hooks/useSecretAuthentication';
import { toast } from 'sonner';
import { decryptSecretsArray } from '@/lib/crypto/secret/crypto-utils.secret';

const columnHelper = createColumnHelper<Secrets>();

interface AvailableSecretsProps {
  projectId: string;
  organizationId: string;
  userId: string;
}

// Helper function to download as CSV
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

// Helper function to download as .env
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
      if (secret.note) {
        lines.push(`# ${secret.note}`);
      }
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

  // Use MKDF config hook
  const { mkdfConfig } = useMKDFConfig({
    organizationId,
    userId,
    enabled: !!userId,
  });

  const { showAuthModal, isAuthenticating, openAuthModal, closeAuthModal, handleAuthentication } =
    useSecretAuthentication<Secrets[]>({
      projectId,
      organizationId,
      userId,
    });

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCopySecret = () => {};

  const handleExport = (format: 'csv' | 'env') => {
    const secrets = allSecrets?.data?.allSecrets || [];
    if (!secrets.length) {
      toast.error('No secrets to export');
      return;
    }
    setExportFormat(format);
    openAuthModal(secrets);
  };

  // Build query parameters
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

  // Success callback for authentication
  const onAuthenticationSuccess = async (projectKey: Uint8Array, secrets: Secrets[]) => {
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

    // Download based on selected format
    if (exportFormat === 'csv') {
      downloadAsCSV(decryptResult.data);
      toast.success(`Exported ${decryptResult.data.length} secrets as CSV`);
    } else {
      downloadAsEnv(decryptResult.data);
      toast.success(`Exported ${decryptResult.data.length} secrets as .env file`);
    }
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
                  onClick={handleCopySecret}
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
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground">{formatDate(row.getValue('updatedAt'))}</p>
              <Button variant="ghost" size="sm">
                <MoreHorizontal />
              </Button>
            </div>
          );
        },
      }),
    ],
    [],
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
          {/* Search and Controls */}
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
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  refetchSecrets();
                }}
              >
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

          {/* Table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="font-semibold">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading || isRefetching ? (
                  <>
                    {Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={index}>
                        {Array.from({
                          length: 3,
                        }).map((_, index) => (
                          <TableCell key={index}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </>
                ) : (
                  <>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} className="group transition-colors">
                          {row
                            .getVisibleCells()
                            .slice(0, columns.length - 1)
                            .map((cell) => (
                              <TableCell key={cell.id} className="w">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}

                          <TableCell className="float-end">
                            {flexRender(
                              row.getVisibleCells()[columns.length - 1].column.columnDef.cell,
                              row.getVisibleCells()[columns.length - 1].getContext(),
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          <div>
                            {debouncedSearchQuery
                              ? `No secrets match "${debouncedSearchQuery}".`
                              : 'No secrets found.'}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm">
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

          {/* No pagination fallback for single page results */}
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
          title="Decrypt Secrets"
          description="Enter your credentials to decrypt and export secrets."
        />
      </CardContent>
    </Card>
  );
};
