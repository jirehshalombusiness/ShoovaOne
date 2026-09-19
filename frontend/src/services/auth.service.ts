import { api } from './api';
import { User, LoginResponse } from '@/types/user.types';

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    const response = await api.post<LoginResponse>(
      '/auth/login',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (response.data.access_token) {
      localStorage.setItem(
        'access_token',
        response.data.access_token
      );

      localStorage.setItem(
        'user',
        JSON.stringify(response.data.user)
      );
    }

    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout API errors.
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },

  async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get<User>('/auth/me');
      return response.data;
    } catch (error) {
      const storedUser = localStorage.getItem('user');

      if (storedUser) {
        return JSON.parse(storedUser);
      }

      throw error;
    }
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  },

  getUserFromStorage(): User | null {
    const user = localStorage.getItem('user');

    if (!user) {
      return null;
    }

    try {
      return JSON.parse(user);
    } catch {
      return null;
    }
  },
};