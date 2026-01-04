import api from './client';
import type {
  Role,
  Direction,
  DirectionCreate,
  DirectionUpdate,
} from '@/types/api';

export const managementApi = {
  // ============= ROLES =============
  // Note: Role management moved to /roles endpoints
  // Use rolesApi from '@/api/roles' for full RBAC functionality

  // Get list of all roles (for backward compatibility)
  listRoles: async (): Promise<Role[]> => {
    const response = await api.get<Role[]>('/management/roles');
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
