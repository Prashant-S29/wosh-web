import { getFromCookie } from '@/lib/utils.cookies';
import { SafeApiResponse } from '@/types/api';
import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

export type TypedQueryOptions<TResponse> = Omit<
  UseQueryOptions<SafeApiResponse<TResponse>, never>,
  'queryFn'
> & {
  endpoint: string;
  method?: 'GET';
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  authRequired?: boolean;
  transformResponse?: (data: unknown) => TResponse;
  enabled?: boolean;
};

export function useTypedQuery<TResponse>(
  options: TypedQueryOptions<TResponse>,
): UseQueryResult<SafeApiResponse<TResponse>, never> {
  const {
    endpoint,
    method = 'GET',
    headers = {},
    params = {},
    authRequired = true,
    transformResponse,
    enabled = true,
    ...queryOptions
  } = options;

  return useQuery<SafeApiResponse<TResponse>, never>({
    queryFn: async (): Promise<SafeApiResponse<TResponse>> => {
      try {
        const url = new URL(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${endpoint}`);

        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        });

        const requestHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...headers,
        };

        if (authRequired) {
          const token = getFromCookie<string>('token');
          if (token) {
            requestHeaders['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch(url.toString(), {
          method,
          headers: requestHeaders,
        });

        const responseData = await response.json();
        if (!response.ok) {
          return {
            data: null,
            error: responseData.message || `HTTP ${response.status} error`,
            message: responseData.message || 'An error occurred',
          };
        }

        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          const transformedData =
            transformResponse && responseData.data
              ? transformResponse(responseData.data)
              : responseData.data;

          return {
            data: transformedData,
            error: responseData.error,
            message: responseData.message,
          };
        } else {
          const transformedData = transformResponse
            ? transformResponse(responseData)
            : responseData;

          return {
            data: transformedData,
            error: null,
            message: 'Success',
          };
        }
      } catch (error) {
        // Network error or parsing error
        const errorMessage =
          error instanceof Error
            ? {
                code: 'UNKNOWN_ERROR',
                message: error.message,
                statusCode: 500,
              }
            : {
                code: 'UNKNOWN_ERROR',
                message: 'Unknown error occurred',
                statusCode: 500,
              };

        return {
          data: null,
          error: errorMessage,
          message: 'An error occurred',
        };
      }
    },
    enabled,
    ...queryOptions,
  });
}
