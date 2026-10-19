import type { AuthResponse, RegisterInput, User } from '../types';
import { http } from './http';

export const authApi = {
  login: (identifier: string, password: string) =>
    http.post<AuthResponse>('/auth/login', { identifier, password }),
  register: (input: RegisterInput) => http.post<AuthResponse>('/auth/register', input),
  me: () => http.get<{ user: User }>('/auth/me'),
};
