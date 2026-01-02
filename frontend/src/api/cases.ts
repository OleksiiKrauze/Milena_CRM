import api from './client';
import type {
  Case,
  CaseCreate,
  CaseUpdate,
  CaseListResponse,
  CaseFull,
} from '@/types/api';

export const casesApi = {
  // Get all cases with pagination
  list: async (params?: {
    skip?: number;
    limit?: number;
    decision_type_filter?: string;
    search_status_filter?: string;
    search_result_filter?: string;
    date_from?: string;
    date_to?: string;
    period?: string;
  }): Promise<CaseListResponse> => {
    const response = await api.get<CaseListResponse>('/cases/', { params });
    return response.data;
  },

  // Get case by ID
  get: async (id: number): Promise<Case> => {
    const response = await api.get<Case>(`/cases/${id}`);
    return response.data;
  },

  // Get case with all related data
  getFull: async (id: number): Promise<CaseFull> => {
    const response = await api.get<CaseFull>(`/cases/${id}/full`);
    return response.data;
  },

  // Create new case
  create: async (data: CaseCreate): Promise<Case> => {
    const response = await api.post<Case>('/cases/', data);
    return response.data;
  },

  // Update case
  update: async (id: number, data: CaseUpdate): Promise<Case> => {
    const response = await api.put<Case>(`/cases/${id}`, data);
    return response.data;
  },

  // Delete case
  delete: async (id: number): Promise<void> => {
    await api.delete(`/cases/${id}`);
  },

  // Autofill case fields using ChatGPT
  autofill: async (initialInfo: string): Promise<{ fields: Record<string, any> }> => {
    const response = await api.post<{ fields: Record<string, any> }>('/cases/autofill', {
      initial_info: initialInfo,
    });
    return response.data;
  },
};
