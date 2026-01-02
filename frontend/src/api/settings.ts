import api from './client';

export interface Settings {
  id: number;
  case_autofill_prompt: string;
}

export interface SettingsUpdate {
  case_autofill_prompt: string;
}

export const settingsApi = {
  // Get settings
  getSettings: async (): Promise<Settings> => {
    const response = await api.get<Settings>('/settings');
    return response.data;
  },

  // Update settings
  updateSettings: async (data: SettingsUpdate): Promise<Settings> => {
    const response = await api.put<Settings>('/settings', data);
    return response.data;
  },
};
