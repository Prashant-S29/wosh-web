export type CreateOrganizationResponse = {
  id: string;
};

export type GetAllAvailableOrganizationsResponse = {
  data: {
    id: string;
    name: string;
  }[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
};
