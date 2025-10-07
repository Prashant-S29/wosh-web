export type CreateProjectResponse = {
  id: string;
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
};

export type GetAllAvailableProjectsResponse = {
  allProjects: Project[];
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

export type UpdateProjectResponse = {
  id: string;
};

export type DeleteProjectResponse = {
  deleted: boolean;
  id: string;
};

export type GetProjectResponse = {
  id: string;
  name: string;
  createdAt: string;
  organizationId: string;
};
