import { api } from './client';
import type { Event, EventCreate, EventUpdate, EventListResponse } from '@/types/api';

export const eventsApi = {
  list: async (params?: { search_id?: number; event_type?: string; skip?: number; limit?: number }): Promise<EventListResponse> => {
    const response = await api.get<EventListResponse>('/events/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Event> => {
    const response = await api.get<Event>(`/events/${id}`);
    return response.data;
  },

  create: async (data: EventCreate): Promise<Event> => {
    const response = await api.post<Event>('/events/', data);
    return response.data;
  },

  update: async (id: number, data: EventUpdate): Promise<Event> => {
    const response = await api.put<Event>(`/events/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/events/${id}`);
  },
};
