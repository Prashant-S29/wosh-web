export type CreateProjectRequest = {
  name: string;
  organizationId: string;
  wrappedSymmetricKey: string;
};

export type UpdateProjectRequest = {
  name: string;
};
