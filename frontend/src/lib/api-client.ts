import { BACKEND_BASE_URL } from '@/constants';
import axios from 'axios';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const axiosInstance = axios.create({
  baseURL: BACKEND_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const apiClient = {
  get: async <T>(endpoint: string): Promise<T> => {
    const response = await axiosInstance.get<T>(endpoint);
    return response.data;
  },

  post: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await axiosInstance.post<T>(endpoint, data);
    return response.data;
  },

  put: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await axiosInstance.put<T>(endpoint, data);
    return response.data;
  },

  patch: async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const response = await axiosInstance.patch<T>(endpoint, data);
    return response.data;
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    const response = await axiosInstance.delete<T>(endpoint);
    return response.data;
  },
};
