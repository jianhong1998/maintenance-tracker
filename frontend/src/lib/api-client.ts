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

let getToken: (() => Promise<string | null>) | null = null;

/**
 * Called by AuthProvider to wire up Firebase ID token retrieval.
 * The interceptor calls this before every request so tokens are always fresh.
 */
export function setAuthTokenGetter(fn: () => Promise<string | null>): void {
  getToken = fn;
}

const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export function setBaseUrl(url: string): void {
  axiosInstance.defaults.baseURL = url;
}

axiosInstance.interceptors.request.use(async (config) => {
  if (getToken) {
    try {
      const token = await getToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // Token fetch failed — send the request without auth.
      // The server will return 401 and the app can handle it.
    }
  }
  return config;
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
