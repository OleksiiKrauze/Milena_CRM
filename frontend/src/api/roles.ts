import api from './client';
import type {
  Role,
  RoleCreate,
  RoleUpdate,
  PermissionsListResponse,
} from '@/types/api';

export const rolesApi = {
  // Get all roles
  list: async (): Promise<Role[]> => {
    const response = await api.get<Role[]>('/roles/');
    return response.data;
  },

  // Get role by ID
  get: async (id: number): Promise<Role> => {
    const response = await api.get<Role>(`/roles/${id}`);
    return response.data;
  },

  // Create new role
  create: async (data: RoleCreate): Promise<Role> => {
    const response = await api.post<Role>('/roles/', data);
    return response.data;
  },

  // Update role
  update: async (id: number, data: RoleUpdate): Promise<Role> => {
    const response = await api.put<Role>(`/roles/${id}`, data);
    return response.data;
  },

  // Delete role
  delete: async (id: number): Promise<void> => {
    await api.delete(`/roles/${id}`);
  },

  // Get all available permissions
  getPermissions: async (): Promise<PermissionsListResponse> => {
    const response = await api.get<PermissionsListResponse>('/roles/permissions/list');
    return response.data;
  },
};
