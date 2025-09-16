import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProps, ClientAuthResult } from '@/types';
import { getFromCookie } from '../utils.cookies';

/**
 * Client-side authentication check hook
 */
export const useCheckAuthClient = ({
  redirectTo = '/login',
  redirect: shouldRedirect = false,
}: AuthProps = {}): ClientAuthResult => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  // states
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const tokenCookie = getFromCookie<string>('token') || null;
      const authenticated = tokenCookie !== null && tokenCookie.trim() !== '';

      setToken(tokenCookie);
      setIsAuthenticated(authenticated);

      if (!authenticated && shouldRedirect) {
        router.push(redirectTo);
      }
    } catch (error) {
      console.error('Error checking client auth:', error);
      setIsAuthenticated(false);
      setToken(null);

      if (shouldRedirect) {
        router.push(redirectTo);
      }
    } finally {
      setIsLoading(false);
    }
  }, [redirectTo, shouldRedirect, router]);

  return {
    isAuthenticated,
    token,
    isLoading,
  };
};
