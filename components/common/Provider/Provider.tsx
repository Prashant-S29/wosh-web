'use client';

import type React from 'react';

// hooks
import { useMounted } from '@/hooks/useMounted';

// components
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useState } from 'react';
import { Toaster } from 'sonner';

interface Props {
  children: React.ReactNode;
}

export const Provider: React.FC<Props> = ({ children }) => {
  const mounted = useMounted();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error: unknown) => {
              const hasStatus = (err: unknown): err is { status: number } => {
                return typeof err === 'object' && err !== null && 'status' in err;
              };

              if (hasStatus(error) && error.status >= 400 && error.status < 500) {
                return false;
              }
              return failureCount < 3;
            },
          },
          mutations: {
            retry: 1,
          },
        },
      }),
  );

  if (!mounted) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={true}
        disableTransitionOnChange
      >
        <Toaster visibleToasts={3} richColors />
        {children}
        {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      </NextThemesProvider>
    </QueryClientProvider>
  );
};
