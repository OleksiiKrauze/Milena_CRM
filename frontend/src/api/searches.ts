import { api } from './client';
import type { Search, SearchCreate, SearchUpdate, SearchListResponse, SearchFull } from '@/types/api';

export const searchesApi = {
  list: async (params?: { case_id?: number; status_filter?: string; result_filter?: string; skip?: number; limit?: number }): Promise<SearchListResponse> => {
    const response = await api.get<SearchListResponse>('/searches/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Search> => {
    const response = await api.get<Search>(`/searches/${id}`);
    return response.data;
  },

  getFull: async (id: number): Promise<SearchFull> => {
    const response = await api.get<SearchFull>(`/searches/${id}/full`);
    return response.data;
  },

  create: async (data: SearchCreate): Promise<Search> => {
    const response = await api.post<Search>('/searches/', data);
    return response.data;
  },

  update: async (id: number, data: SearchUpdate): Promise<Search> => {
    const response = await api.put<Search>(`/searches/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/searches/${id}`);
  },
};
