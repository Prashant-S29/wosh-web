export interface AuthProps {
  redirectTo?: string;
  redirect?: boolean;
}

export interface AuthResult {
  isAuthenticated: boolean;
  token: string | null;
}

export interface ClientAuthResult extends AuthResult {
  isLoading: boolean;
}
