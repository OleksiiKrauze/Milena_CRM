import api from './client';
import type {
  Organization,
  OrganizationCreate,
  OrganizationUpdate,
  OrganizationListResponse,
} from '@/types/api';

export const organizationsApi = {
  list: async (params?: {
    skip?: number;
    limit?: number;
    type_filter?: string;
    region_filter?: string;
    search_query?: string;
  }): Promise<OrganizationListResponse> => {
    const response = await api.get<OrganizationListResponse>('/organizations/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Organization> => {
    const response = await api.get<Organization>(`/organizations/${id}`);
    return response.data;
  },

  create: async (data: OrganizationCreate): Promise<Organization> => {
    const response = await api.post<Organization>('/organizations/', data);
    return response.data;
  },

  update: async (id: number, data: OrganizationUpdate): Promise<Organization> => {
    const response = await api.put<Organization>(`/organizations/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/organizations/${id}`);
  },
};
