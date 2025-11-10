import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFromCookie } from '../utils.cookies';
import { useTypedQuery } from '@/hooks';
import { GetSessionResponse } from '@/types/api/response';
import { AuthProps } from '@/types';

/**
 * Get cookie value directly from document.cookie (client-side only)
 */
const getCookieValue = (name: string): string | null => {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

/**
 * Client-side authentication check hook
 */
export const useCheckAuthClient = ({ redirect = true, redirectTo = '/login' }: AuthProps = {}) => {
  const router = useRouter();

  // states
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCheckedCookie, setHasCheckedCookie] = useState(false);

  // Get session data from API
  const {
    data: sessionData,
    isLoading: sessionLoading,
    error,
  } = useTypedQuery<GetSessionResponse>({
    endpoint: '/api/auth/session',
    queryKey: ['user-session', token],
    enabled: !!token && hasCheckedCookie,
  });

  // Check token from cookie on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      let authCookie = getCookieValue('token');

      if (!authCookie) {
        authCookie = getFromCookie<string>('token') ?? null;
      }

      setToken(authCookie);
      setHasCheckedCookie(true);
    } catch (error) {
      console.error('Error getting token from cookie:', error);
      setToken(null);
      setHasCheckedCookie(true);
    }
  }, []);

  useEffect(() => {
    if (!hasCheckedCookie) {
      return;
    }

    if (!token) {
      setIsAuthenticated(false);
      setIsLoading(false);

      if (redirect) {
        router.push(redirectTo);
      }
    }

    if (sessionLoading) {
      setIsLoading(true);
      return;
    }

    if (error || !sessionData?.data?.user?.id) {
      setToken(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      if (token) {
        router.push('/logout');
      }
      return;
    }

    setIsAuthenticated(true);
    setIsLoading(false);
  }, [hasCheckedCookie, token, sessionData, sessionLoading, error, router, redirect, redirectTo]);

  return {
    isAuthenticated,
    token,
    session: sessionData?.data || null,
    isLoading: isLoading || !hasCheckedCookie,
  };
};
