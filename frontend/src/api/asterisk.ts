import api from './client';
import type { CallRecordingsResponse, AsteriskSettings } from '@/types/api';

export interface RecordingsListParams {
  skip?: number;
  limit?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
  search?: string;
}

export const asteriskApi = {
  listRecordings: async (params: RecordingsListParams = {}): Promise<CallRecordingsResponse> => {
    const response = await api.get<CallRecordingsResponse>('/asterisk/recordings', { params });
    return response.data;
  },

  getDownloadUrl: (filename: string): string => {
    const base = import.meta.env.VITE_API_URL || '/api';
    const encoded = encodeURIComponent(filename);
    const token = localStorage.getItem('auth_token') || '';
    return `${base}/asterisk/recordings/download?filename=${encoded}&token=${token}`;
  },

  downloadRecording: async (filename: string): Promise<Blob> => {
    const response = await api.get('/asterisk/recordings/download', {
      params: { filename },
      responseType: 'blob',
    });
    return response.data;
  },

  getSettings: async (): Promise<AsteriskSettings> => {
    const response = await api.get<AsteriskSettings>('/asterisk/settings');
    return response.data;
  },

  updateSettings: async (data: Partial<AsteriskSettings>): Promise<AsteriskSettings> => {
    const response = await api.put<AsteriskSettings>('/asterisk/settings', data);
    return response.data;
  },
};
