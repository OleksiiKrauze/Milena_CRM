import api from './client';
import type {
  RoleDetail,
  RoleCreate,
  RoleUpdate,
  Direction,
  DirectionCreate,
  DirectionUpdate,
} from '@/types/api';

export const managementApi = {
  // ============= ROLES =============

  // Get list of all roles
  listRoles: async (): Promise<RoleDetail[]> => {
    const response = await api.get<RoleDetail[]>('/management/roles');
    return response.data;
  },

  // Create a new role
  createRole: async (data: RoleCreate): Promise<RoleDetail> => {
    const response = await api.post<RoleDetail>('/management/roles', data);
    return response.data;
  },

  // Update a role
  updateRole: async (roleId: number, data: RoleUpdate): Promise<RoleDetail> => {
    const response = await api.put<RoleDetail>(`/management/roles/${roleId}`, data);
    return response.data;
  },

  // Delete a role
  deleteRole: async (roleId: number): Promise<{ detail: string }> => {
    const response = await api.delete<{ detail: string }>(`/management/roles/${roleId}`);
    return response.data;
  },

  // ============= DIRECTIONS =============

  // Get list of all directions
  listDirections: async (): Promise<Direction[]> => {
    const response = await api.get<Direction[]>('/management/directions');
    return response.data;
  },

  // Create a new direction
  createDirection: async (data: DirectionCreate): Promise<Direction> => {
    const response = await api.post<Direction>('/management/directions', data);
    return response.data;
  },

  // Update a direction
  updateDirection: async (directionId: number, data: DirectionUpdate): Promise<Direction> => {
    const response = await api.put<Direction>(`/management/directions/${directionId}`, data);
    return response.data;
  },

  // Delete a direction
  deleteDirection: async (directionId: number): Promise<{ detail: string }> => {
    const response = await api.delete<{ detail: string }>(`/management/directions/${directionId}`);
    return response.data;
  },
};
