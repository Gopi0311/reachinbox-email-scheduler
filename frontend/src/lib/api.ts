import { EmailJob, PaginatedResult, SchedulePayload, SlackStatus, Stats, User } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

async function fetcher<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // essential for express-session cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const json = await response.json();

  if (!response.ok) {
    const errorMsg = json.error || json.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return json.data as T;
}

export const api = {
  auth: {
    me: () => fetcher<User>('/auth/me'),
    logout: () =>
      fetcher<{ message: string }>('/auth/logout', {
        method: 'POST',
      }),
  },

  emails: {
    schedule: (payload: SchedulePayload) =>
      fetcher<{ scheduledCount: number; batchId: string }>('/api/emails/schedule', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getScheduled: (page = 1, limit = 10) =>
      fetcher<PaginatedResult<EmailJob>>(`/api/emails/scheduled?page=${page}&limit=${limit}`),
    getSent: (page = 1, limit = 10) =>
      fetcher<PaginatedResult<EmailJob>>(`/api/emails/sent?page=${page}&limit=${limit}`),
    search: (query: string, page = 1, limit = 10) =>
      fetcher<PaginatedResult<EmailJob>>(
        `/api/emails/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
      ),
    getById: (id: string) => fetcher<EmailJob>(`/api/emails/${id}`),
    cancel: (id: string) =>
      fetcher<{ message: string }>(`/api/emails/${id}`, {
        method: 'DELETE',
      }),
    getStats: () => fetcher<Stats>('/api/emails/stats'),
  },

  slack: {
    getStatus: () => fetcher<SlackStatus>('/api/slack/status'),
    connect: () => fetcher<{ authUrl: string }>('/api/slack/connect'),
    disconnect: () =>
      fetcher<{ message: string }>('/api/slack/disconnect', {
        method: 'POST',
      }),
    test: () =>
      fetcher<{ sent: boolean; message: string }>('/api/slack/test', {
        method: 'POST',
      }),
  },
};
