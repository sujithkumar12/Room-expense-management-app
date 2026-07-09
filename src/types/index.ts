export interface User {
  id: number;
  name: string;
  email: string;
  upiId?: string | null;
  createdAt?: string;
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
  upiId?: string | null;
  totalPaid: number;
  balance: number;
  expenseBalance?: number;
  settledPaid?: number;
  settledReceived?: number;
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

export interface Settlement {
  id: number;
  amount: number;
  note: string | null;
  created_at: string;
  payer_id: number;
  payer_name: string;
  payee_id: number;
  payee_name: string;
}

export type PaymentRequestStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export interface PaymentRequest {
  id: number;
  amount: number;
  status: PaymentRequestStatus;
  created_at: string;
  settlement_year: number;
  settlement_month: number;
  payer_id: number;
  payer_name: string;
  payee_id: number;
  payee_name: string;
}

export interface RoomSummary {
  monthlyExpense: number;
  previousMonthExpense: number;
  monthChangePercent: number | null;
  weeklyExpense: number;
  weeklyLimit: number | null;
  memberCount: number;
  equalShare: number;
  monthLabel: string;
  previousMonthLabel: string;
  selectedYear: number;
  selectedMonth: number;
  isCurrentMonth: boolean;
}

export interface MonthOption {
  year: number;
  month: number;
  label: string;
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
  previousYearTotal: number;
  yearChangePercent: number | null;
  availableYears: number[];
  currentMonthTotal: number;
  currentMonthLabel: string;
  currentMonthNum: number;
  currentMonthYear: number;
  previousMonthTotal: number;
  previousMonthLabel: string;
  monthChangePercent: number | null;
  currentWeekTotal: number;
  weeklyLimit: number | null;
}

export type ExpenseSort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

export interface RoomActivity {
  id: string;
  activity_type: string;
  message: string;
  actor_name: string;
  created_at: string;
}
