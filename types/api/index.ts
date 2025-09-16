export * from './types.apiRequest';
export * from './types.apiResponse';

export type ApiError = {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
};

export type BackendResponse<T> = {
  data: T | null;
  error: string | null;
  message: string;
};

export type SafeApiResponse<T> = BackendResponse<T>;
