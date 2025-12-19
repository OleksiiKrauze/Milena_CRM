import { api } from './client';

export const uploadApi = {
  uploadImages: async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post<string[]>('/upload/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  uploadMedia: async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await api.post<string[]>('/upload/media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  deleteImage: async (filename: string): Promise<void> => {
    await api.delete(`/upload/images/${filename}`);
  },
};
