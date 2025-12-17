import api from './client';
import type {
  User,
  Role,
  Direction,
  UserUpdate,
  ChangePasswordRequest,
  UsersListResponse,
} from '@/types/api';

export const usersApi = {
  // Get list of users (admin only)
  list: async (params?: {
    skip?: number;
    limit?: number;
    status_filter?: string;
  }): Promise<UsersListResponse> => {
    const response = await api.get<UsersListResponse>('/users/', { params });
    return response.data;
  },

  // Get user by ID
  get: async (userId: number): Promise<User> => {
    const response = await api.get<User>(`/users/${userId}`);
    return response.data;
  },

  // Update user (admin only)
  update: async (userId: number, data: UserUpdate): Promise<User> => {
    const response = await api.put<User>(`/users/${userId}`, data);
    return response.data;
  },

  // Delete user (admin only)
  delete: async (userId: number): Promise<{ detail: string }> => {
    const response = await api.delete<{ detail: string }>(`/users/${userId}`);
    return response.data;
  },

  // Get list of all roles (admin only)
  listRoles: async (): Promise<Role[]> => {
    const response = await api.get<Role[]>('/users/roles');
    return response.data;
  },

  // Get list of all directions (admin only)
  listDirections: async (): Promise<Direction[]> => {
    const response = await api.get<Direction[]>('/users/directions');
    return response.data;
  },

  // Change password (any authenticated user)
  changePassword: async (data: ChangePasswordRequest): Promise<{ detail: string }> => {
    const response = await api.post<{ detail: string }>('/auth/change-password', data);
    return response.data;
  },
};
