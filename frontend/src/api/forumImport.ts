import { api } from './client';

export interface ForumImportStatus {
  id: number;
  is_running: boolean;
  status: string;
  total_topics: number;
  processed_topics: number;
  successful_topics: number;
  failed_topics: number;
  current_topic_title?: string;
  current_operation?: string;
  started_at?: string;
  finished_at?: string;
  updated_at?: string;
  last_error?: string;
  forum_url?: string;
  subforum_id?: number;
}

export interface ForumImportSettings {
  forum_url?: string;
  forum_username?: string;
  forum_password?: string;
  forum_subforum_id?: number;
}

export interface ForumImportStartRequest {
  forum_url: string;
  forum_username: string;
  forum_password: string;
  subforum_id: number;
  max_topics: number;
  api_email: string;
  api_password: string;
}

export const forumImportApi = {
  getStatus: async (): Promise<ForumImportStatus> => {
    const response = await api.get('/forum-import/status');
    return response.data;
  },

  startImport: async (request: ForumImportStartRequest): Promise<ForumImportStatus> => {
    const response = await api.post('/forum-import/start', request);
    return response.data;
  },

  stopImport: async (): Promise<ForumImportStatus> => {
    const response = await api.post('/forum-import/stop');
    return response.data;
  },

  getSettings: async (): Promise<ForumImportSettings> => {
    const response = await api.get('/forum-import/settings');
    return response.data;
  },

  updateSettings: async (settings: Partial<ForumImportSettings>): Promise<ForumImportSettings> => {
    const response = await api.put('/forum-import/settings', settings);
    return response.data;
  },
};
