import type { Room, Member, Expense, RoomSummary, DashboardData } from '../types';

const TOKEN_KEY = 'roomsplit_token';
const USER_KEY = 'roomsplit_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: { id: number; name: string; email: string }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser(): { id: number; name: string; email: string } | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data as T;
}

export const api = {
  signup: (body: { name: string; email: string; password: string }) =>
    request<{ token: string; user: { id: number; name: string; email: string } }>(
      '/auth/signup',
      { method: 'POST', body: JSON.stringify(body) }
    ),

  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: { id: number; name: string; email: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(body) }
    ),

  getRooms: () => request<{ rooms: Room[] }>('/rooms'),

  createRoom: (name: string) =>
    request<{ room: Room }>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  joinRoom: (inviteCode: string) =>
    request<{ room: Room }>('/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    }),

  getRoom: (id: number) =>
    request<{
      room: Room;
      members: Member[];
      expenses: Expense[];
      summary: RoomSummary;
    }>(`/rooms/${id}`),

  addExpense: (body: {
    roomId: number;
    amount: number;
    purpose: string;
    expenseDate?: string;
  }) =>
    request<{ expense: Expense }>('/expenses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getDashboard: (roomId: number, year?: number) => {
    const params = new URLSearchParams({ roomId: String(roomId) });
    if (year) params.set('year', String(year));
    return request<DashboardData>(`/dashboard/monthly?${params}`);
  },
};
