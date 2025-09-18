import { getFromCookie } from '@/lib/utils.cookies';
import { SafeApiResponse } from '@/types/api';
import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';

export type TypedMutationOptions<TRequest, TResponse> = Omit<
  UseMutationOptions<SafeApiResponse<TResponse>, never, TRequest>,
  'mutationFn'
> & {
  endpoint: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  authRequired?: boolean;
  transformRequest?: (data: TRequest) => any;
  transformResponse?: (data: any) => TResponse;
};

export function useTypedMutation<TRequest, TResponse>(
  options: TypedMutationOptions<TRequest, TResponse>,
): UseMutationResult<SafeApiResponse<TResponse>, never, TRequest> {
  const {
    endpoint,
    method = 'POST',
    headers = {},
    authRequired = true,
    transformRequest,
    transformResponse,
    ...mutationOptions
  } = options;

  return useMutation<SafeApiResponse<TResponse>, never, TRequest>({
    mutationFn: async (data: TRequest): Promise<SafeApiResponse<TResponse>> => {
      try {
        const requestBody = transformRequest ? transformRequest(data) : data;

        const requestHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...headers,
        };

        // Add auth header if required
        if (authRequired) {
          const token = getFromCookie<string>('token');
          if (token) {
            requestHeaders['Authorization'] = `Bearer ${token}`;
          }
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${endpoint}`, {
          method,
          headers: requestHeaders,
          body: JSON.stringify(requestBody),
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        return {
          data: null,
          error: errorMessage,
          message: errorMessage,
        };
      }
    },
    ...mutationOptions,
  });
}
