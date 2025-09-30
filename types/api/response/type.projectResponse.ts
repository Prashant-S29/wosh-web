export type CreateProjectResponse = {
  id: string;
};

export type GetAllAvailableProjectsResponse = {
  allProjects: {
    id: string;
    name: string;
  }[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

export type GetProjectKeysResponse = {
  wrappedSymmetricKey: string;
};
