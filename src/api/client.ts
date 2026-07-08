import type { Room, Member, Expense, RoomSummary, DashboardData, MonthOption, Settlement } from '../types';

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
    throw new Error(data.error || data.message || 'Something went wrong');
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

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

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

  getRoom: (id: number, year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year) params.set('year', String(year));
    if (month) params.set('month', String(month));
    const qs = params.toString();
    return request<{
      room: Room;
      members: Member[];
      expenses: Expense[];
      settlements: Settlement[];
      summary: RoomSummary;
      availableMonths: MonthOption[];
    }>(`/rooms/${id}${qs ? `?${qs}` : ''}`);
  },

  setWeeklyLimit: (roomId: number, weeklyLimit: number | null) =>
    request<{ room: Room }>(`/rooms/${roomId}`, {
      method: 'PATCH',
      body: JSON.stringify({ weeklyLimit }),
    }),

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

  updateExpense: (
    expenseId: number,
    body: { amount: number; purpose: string; expenseDate?: string }
  ) =>
    request<{ expense: Expense }>(`/expenses/${expenseId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteExpense: (expenseId: number) =>
    request<{ success: boolean }>(`/expenses/${expenseId}`, {
      method: 'DELETE',
    }),

  addSettlement: (body: {
    roomId: number;
    payeeId: number;
    amount: number;
    note?: string;
    year: number;
    month: number;
  }) =>
    request<{ settlement: Settlement }>('/settlements', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteSettlement: (settlementId: number) =>
    request<{ success: boolean }>(`/settlements/${settlementId}`, {
      method: 'DELETE',
    }),

  getDashboard: (roomId: number, year?: number) => {
    const params = new URLSearchParams({ roomId: String(roomId) });
    if (year) params.set('year', String(year));
    return request<DashboardData>(`/dashboard/monthly?${params}`);
  },
};
