import { api } from './client';
import type { FlyerTemplate, FlyerTemplateListResponse } from '@/types/api';

export const flyerTemplatesApi = {
  // Get all templates
  list: async (params?: { template_type?: string; is_active?: number }): Promise<FlyerTemplateListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.template_type) queryParams.append('template_type', params.template_type);
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());

    const query = queryParams.toString();
    const url = query ? `/flyer-templates?${query}` : '/flyer-templates';

    const response = await api.get<FlyerTemplateListResponse>(url);
    return response.data;
  },

  // Get single template
  get: async (id: number): Promise<FlyerTemplate> => {
    const response = await api.get<FlyerTemplate>(`/flyer-templates/${id}`);
    return response.data;
  },

  // Upload template
  upload: async (data: {
    template_type: string;
    file: File;
    description?: string;
  }): Promise<FlyerTemplate> => {
    const formData = new FormData();
    formData.append('template_type', data.template_type);
    formData.append('file', data.file);
    if (data.description) {
      formData.append('description', data.description);
    }

    const response = await api.post<FlyerTemplate>('/flyer-templates/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Update template
  update: async (id: number, data: {
    description?: string;
    gpt_prompt?: string;
    is_active?: number;
  }): Promise<FlyerTemplate> => {
    const response = await api.patch<FlyerTemplate>(`/flyer-templates/${id}`, data);
    return response.data;
  },

  // Delete template
  delete: async (id: number): Promise<void> => {
    await api.delete(`/flyer-templates/${id}`);
  },
};
