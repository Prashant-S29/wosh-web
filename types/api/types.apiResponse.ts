export type LoginResponse = {
  token: string;
};

export type SignupResponse = {
  token: string;
};

export type GetSessionResponse = {
  session: {
    expiresAt: string;
    token: string;
    createdAt: string;
    updatedAt: string;
    ipAddress: string;
    userAgent: string;
    userId: string;
    id: string;
  };
  user: {
    name: string;
    email: string;
    emailVerified: false;
    image: null;
    createdAt: string;
    updatedAt: string;
    id: string;
  };
};
