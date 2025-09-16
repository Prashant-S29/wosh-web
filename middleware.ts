import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  const isLoggedIn = Boolean(token);

  if (isLoggedIn && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!isLoggedIn && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/signup', '/dashboard/:path*'],
};
