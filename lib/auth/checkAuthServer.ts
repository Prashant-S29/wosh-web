import { AuthProps, AuthResult } from '@/types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Server-side authentication check
 */
export const checkAuthServer = async ({
  redirectTo = '/login',
  redirect: shouldRedirect = true,
}: AuthProps = {}): Promise<AuthResult> => {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('token');
    const token = tokenCookie?.value || null;
    const isAuthenticated = token !== null && token.trim() !== '';

    if (!isAuthenticated && shouldRedirect) {
      redirect(redirectTo);
    }

    return {
      isAuthenticated,
      data: {},
      token,
    };
  } catch (error) {
    console.error('Error checking server auth:', error);

    if (shouldRedirect) {
      redirect(redirectTo);
    }

    return {
      isAuthenticated: false,
      data: {},
      token: null,
    };
  }
};
