export type BackendError = {
  code: string;
  message: string;
  statusCode: number;
};

export type BackendResponse<T> = {
  data: T | null;
  error: BackendError | null;
  message: string;
};

export type SafeApiResponse<T> = BackendResponse<T>;
