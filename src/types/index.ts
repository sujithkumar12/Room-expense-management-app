export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Room {
  id: number;
  name: string;
  invite_code: string;
  created_at: string;
  created_by?: number;
  weekly_limit?: number | null;
  is_admin?: boolean;
  member_count?: number;
}

export interface Member {
  id: number;
  name: string;
  email: string;
  totalPaid: number;
  balance: number;
}

export interface Expense {
  id: number;
  amount: number;
  purpose: string;
  expense_date: string;
  created_at: string;
  user_id: number;
  user_name: string;
}

export interface RoomSummary {
  monthlyExpense: number;
  weeklyExpense: number;
  weeklyLimit: number | null;
  memberCount: number;
  equalShare: number;
  monthLabel: string;
}

export interface MonthlyData {
  month: string;
  monthNum: number;
  total: number;
}

export interface DashboardData {
  year: number;
  monthly: MonthlyData[];
  byMember: { name: string; total: number }[];
  yearTotal: number;
}
