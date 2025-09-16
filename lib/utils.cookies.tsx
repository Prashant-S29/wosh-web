// Cookie options interface
export interface CookieOptions {
  expires?: Date | number; // Date object or days from now
  maxAge?: number; // seconds
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

// Default cookie options
const defaultOptions: CookieOptions = {
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
};

// Saves data to cookies (client-side)
export const saveToCookie = <T,>(
  key: string,
  value: T,
  options: CookieOptions = {},
): void => {
  try {
    if (typeof window === 'undefined') {
      console.warn('saveToCookie called on server side');
      return;
    }

    const mergedOptions = { ...defaultOptions, ...options };

    const serializedValue =
      typeof value === 'string' ? value : JSON.stringify(value);

    let cookieString = `${encodeURIComponent(key)}=${encodeURIComponent(
      serializedValue,
    )}`;

    // Handle expires option
    if (mergedOptions.expires) {
      let expiresDate: Date;
      if (typeof mergedOptions.expires === 'number') {
        // If number is provided, treat as days from now
        expiresDate = new Date();
        expiresDate.setDate(expiresDate.getDate() + mergedOptions.expires);
      } else {
        expiresDate = mergedOptions.expires;
      }
      cookieString += `; expires=${expiresDate.toUTCString()}`;
    }

    // Handle maxAge option
    if (mergedOptions.maxAge) {
      cookieString += `; max-age=${mergedOptions.maxAge}`;
    }

    // Handle other options
    if (mergedOptions.domain) {
      cookieString += `; domain=${mergedOptions.domain}`;
    }

    if (mergedOptions.path) {
      cookieString += `; path=${mergedOptions.path}`;
    }

    if (mergedOptions.secure) {
      cookieString += `; secure`;
    }

    if (mergedOptions.httpOnly) {
      cookieString += `; httponly`;
    }

    if (mergedOptions.sameSite) {
      cookieString += `; samesite=${mergedOptions.sameSite}`;
    }

    document.cookie = cookieString;
  } catch (error) {
    console.error('Error saving to cookie:', error);
  }
};

// Gets data from cookies (client-side)
export const getFromCookie = <T,>(key: string): T | undefined => {
  try {
    if (typeof window === 'undefined') {
      console.warn('getFromCookie called on server side');
      return undefined;
    }

    const cookies = document.cookie.split(';');
    const targetCookie = cookies.find((cookie) => {
      const [cookieKey] = cookie.trim().split('=');
      return decodeURIComponent(cookieKey) === key;
    });

    if (targetCookie) {
      const [, cookieValue] = targetCookie.trim().split('=');
      const decodedValue = decodeURIComponent(cookieValue);

      try {
        return JSON.parse(decodedValue) as T;
      } catch {
        return decodedValue as T;
      }
    }
  } catch (error) {
    console.error('Error reading from cookie:', error);
  }

  return undefined;
};

// Removes a cookie (client-side)
export const removeCookie = (
  key: string,
  options: Pick<CookieOptions, 'domain' | 'path'> = {},
): void => {
  try {
    if (typeof window === 'undefined') {
      console.warn('removeCookie called on server side');
      return;
    }

    const mergedOptions = { ...defaultOptions, ...options };
    let cookieString = `${encodeURIComponent(
      key,
    )}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;

    if (mergedOptions.domain) {
      cookieString += `; domain=${mergedOptions.domain}`;
    }

    if (mergedOptions.path) {
      cookieString += `; path=${mergedOptions.path}`;
    }

    document.cookie = cookieString;
  } catch (error) {
    console.error('Error removing cookie:', error);
  }
};

// Server-side cookie helpers (for API routes and server components)
// export const serverCookieHelpers = {
//   // Parse cookies from request headers
//   parseCookies: (cookieHeader: string | undefined): Record<string, string> => {
//     const cookies: Record<string, string> = {};

//     if (!cookieHeader) return cookies;

//     try {
//       cookieHeader.split(';').forEach((cookie) => {
//         const [key, value] = cookie.trim().split('=');
//         if (key && value) {
//           cookies[decodeURIComponent(key)] = decodeURIComponent(value);
//         }
//       });
//     } catch (error) {
//       console.error('Error parsing cookies:', error);
//     }

//     return cookies;
//   },

//   // Get typed cookie value from parsed cookies
//   getServerCookie: <T,>(
//     cookies: Record<string, string>,
//     key: string,
//   ): T | undefined => {
//     try {
//       const value = cookies[key];
//       if (value) {
//         return JSON.parse(value) as T;
//       }
//     } catch (error) {
//       console.error('Error parsing server cookie:', error);
//     }

//     return undefined;
//   },

//   // Create cookie string for Set-Cookie header
//   createCookieHeader: <T,>(
//     key: string,
//     value: T,
//     options: CookieOptions = {},
//   ): string => {
//     try {
//       const mergedOptions = { ...defaultOptions, ...options };
//       let cookieString = `${encodeURIComponent(key)}=${encodeURIComponent(
//         JSON.stringify(value),
//       )}`;

//       if (mergedOptions.expires) {
//         let expiresDate: Date;
//         if (typeof mergedOptions.expires === 'number') {
//           expiresDate = new Date();
//           expiresDate.setDate(expiresDate.getDate() + mergedOptions.expires);
//         } else {
//           expiresDate = mergedOptions.expires;
//         }
//         cookieString += `; Expires=${expiresDate.toUTCString()}`;
//       }

//       if (mergedOptions.maxAge) {
//         cookieString += `; Max-Age=${mergedOptions.maxAge}`;
//       }

//       if (mergedOptions.domain) {
//         cookieString += `; Domain=${mergedOptions.domain}`;
//       }

//       if (mergedOptions.path) {
//         cookieString += `; Path=${mergedOptions.path}`;
//       }

//       if (mergedOptions.secure) {
//         cookieString += `; Secure`;
//       }

//       if (mergedOptions.httpOnly) {
//         cookieString += `; HttpOnly`;
//       }

//       if (mergedOptions.sameSite) {
//         cookieString += `; SameSite=${mergedOptions.sameSite}`;
//       }

//       return cookieString;
//     } catch (error) {
//       console.error('Error creating cookie header:', error);
//       return '';
//     }
//   },
// };

// // Check if cookies are available (client-side)
// export const areCookiesEnabled = (): boolean => {
//   try {
//     if (typeof window === 'undefined') return false;

//     const testKey = '__cookie_test__';
//     saveToCookie(testKey, 'test');
//     const testValue = getFromCookie(testKey);
//     removeCookie(testKey);

//     return testValue === 'test';
//   } catch {
//     return false;
//   }
// };
