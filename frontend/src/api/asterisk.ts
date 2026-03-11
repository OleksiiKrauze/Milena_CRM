import api from './client';
import type { CallRecording, CallRecordingsResponse, AsteriskSettings, RecordingLink, CaseRecordingsResponse } from '@/types/api';

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

  linkRecording: async (recording: CallRecording, caseId: number): Promise<RecordingLink> => {
    const response = await api.post<RecordingLink>('/asterisk/recordings/link', {
      uniqueid: recording.uniqueid,
      case_id: caseId,
      calldate: recording.calldate,
      src: recording.src,
      dst: recording.dst,
      duration: recording.duration,
      billsec: recording.billsec,
      disposition: recording.disposition,
      recordingfile: recording.recordingfile,
    });
    return response.data;
  },

  unlinkRecording: async (linkId: number): Promise<void> => {
    await api.delete(`/asterisk/recordings/link/${linkId}`);
  },

  getRecordingsByCase: async (caseId: number): Promise<CaseRecordingsResponse> => {
    const response = await api.get<CaseRecordingsResponse>(`/asterisk/recordings/by-case/${caseId}`);
    return response.data;
  },

  getLinksByUniqueid: async (uniqueid: string): Promise<CaseRecordingsResponse> => {
    const response = await api.get<CaseRecordingsResponse>(`/asterisk/recordings/links-by-uniqueid/${encodeURIComponent(uniqueid)}`);
    return response.data;
  },

  transcribeRecording: async (filename: string): Promise<{ transcript: string }> => {
    const response = await api.post<{ transcript: string }>('/asterisk/recordings/transcribe', { filename });
    return response.data;
  },
};
