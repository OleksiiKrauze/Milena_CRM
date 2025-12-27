import { api } from './client';
import type { FieldSearch } from '@/types/api';

export interface FieldSearchListResponse {
  total: number;
  field_searches: FieldSearch[];
}

export interface FieldSearchCreate {
  search_id: number;
  initiator_inforg_id?: number;
  start_date?: string;
  flyer_id?: number;
  meeting_datetime?: string;
  meeting_place?: string;
  coordinator_id?: number;
  status?: string;
  end_date?: string;
  result?: string;
  notes?: string;
}

export interface FieldSearchUpdate {
  initiator_inforg_id?: number;
  start_date?: string;
  flyer_id?: number;
  meeting_datetime?: string;
  meeting_place?: string;
  coordinator_id?: number;
  status?: string;
  end_date?: string;
  result?: string;
  notes?: string;
}

export const fieldSearchesApi = {
  list: async (params?: { case_id?: number; status_filter?: string; skip?: number; limit?: number }): Promise<FieldSearchListResponse> => {
    const response = await api.get<FieldSearchListResponse>('/field_searches/', { params });
    return response.data;
  },

  get: async (id: number): Promise<FieldSearch> => {
    const response = await api.get<FieldSearch>(`/field_searches/${id}`);
    return response.data;
  },

  create: async (data: FieldSearchCreate): Promise<FieldSearch> => {
    const response = await api.post<FieldSearch>('/field_searches/', data);
    return response.data;
  },

  update: async (id: number, data: FieldSearchUpdate): Promise<FieldSearch> => {
    const response = await api.put<FieldSearch>(`/field_searches/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/field_searches/${id}`);
  },

  generateGrid: async (fieldSearchId: number): Promise<{ grid_file_url: string; filename: string }> => {
    const response = await api.post<{ grid_file_url: string; filename: string }>(`/field_searches/${fieldSearchId}/generate-grid`);
    return response.data;
  },
};
