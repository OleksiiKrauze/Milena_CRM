import { api } from './client';
import type { Orientation, OrientationListResponse } from '@/types/api';

export const orientationsApi = {
  // Get all orientations
  list: async (params?: {
    search_id?: number;
    is_approved?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<OrientationListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.search_id !== undefined) queryParams.append('search_id', params.search_id.toString());
    if (params?.is_approved !== undefined) queryParams.append('is_approved', params.is_approved.toString());
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());

    const query = queryParams.toString();
    const url = query ? `/orientations?${query}` : '/orientations';

    const response = await api.get<OrientationListResponse>(url);
    return response.data;
  },

  // Get single orientation
  get: async (id: number): Promise<Orientation> => {
    const response = await api.get<Orientation>(`/orientations/${id}`);
    return response.data;
  },

  // Create orientation
  create: async (data: {
    search_id: number;
    template_id?: number;
    selected_photos?: string[];
    canvas_data?: Record<string, unknown>;
    text_content?: string;
    is_approved?: boolean;
  }): Promise<Orientation> => {
    const response = await api.post<Orientation>('/orientations/', data);
    return response.data;
  },

  // Update orientation
  update: async (id: number, data: {
    template_id?: number;
    selected_photos?: string[];
    canvas_data?: Record<string, unknown>;
    text_content?: string;
    is_approved?: boolean;
    exported_files?: string[];
    uploaded_images?: string[];
  }): Promise<Orientation> => {
    const response = await api.patch<Orientation>(`/orientations/${id}`, data);
    return response.data;
  },

  // Delete orientation
  delete: async (id: number): Promise<void> => {
    await api.delete(`/orientations/${id}`);
  },
};
