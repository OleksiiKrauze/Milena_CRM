import api from './client';
import type { InstitutionsCall, InstitutionsCallCreate } from '@/types/api';

export const institutionsApi = {
  // Create institutions call
  create: async (data: InstitutionsCallCreate): Promise<InstitutionsCall> => {
    const response = await api.post<InstitutionsCall>(
      '/institutions_calls/',
      data
    );
    return response.data;
  },

  // Get institutions calls for a case
  listByCase: async (caseId: number): Promise<InstitutionsCall[]> => {
    const response = await api.get<{
      total: number;
      institutions_calls: InstitutionsCall[];
    }>('/institutions_calls/', {
      params: { case_id: caseId },
    });
    return response.data.institutions_calls;
  },

  // Update institutions call
  update: async (
    id: number,
    data: Partial<InstitutionsCallCreate>
  ): Promise<InstitutionsCall> => {
    const response = await api.put<InstitutionsCall>(
      `/institutions_calls/${id}`,
      data
    );
    return response.data;
  },

  // Delete institutions call
  delete: async (id: number): Promise<void> => {
    await api.delete(`/institutions_calls/${id}`);
  },
};
