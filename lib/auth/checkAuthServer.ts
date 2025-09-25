import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GetSessionResponse } from '@/types/api/response';

/**
 * Server-side authentication check
 */
export const checkAuthServer = async () => {
  try {
    // Get token from cookies
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('token');
    const token = tokenCookie?.value || null;

    if (!token || token.trim() === '') {
      redirect('/login');
    }

    let sessionData: { data: GetSessionResponse; error: string | null; message: string } | null =
      null;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/api/auth/session`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-cache',
      });

      if (response.ok) {
        const result = await response.json();
        sessionData = result;
      } else {
        console.error('Session API call failed:', response.status, response.statusText);
        redirect('/logout');
      }
    } catch (apiError) {
      console.error('Error calling session API:', apiError);
      redirect('/logout');
    }

    // Check if session data contains valid user
    if (!sessionData?.data || !sessionData?.data?.user?.id) {
      redirect('/logout');
    }

    // User is authenticated
    return {
      isAuthenticated: true,
      token,
      session: sessionData?.data,
    };
  } catch (error) {
    console.error('Error checking server auth:', error);
    redirect('/logout');
  }
};
