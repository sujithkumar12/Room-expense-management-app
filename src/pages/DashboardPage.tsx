import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import type { DashboardData } from '../types';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#4f46e5'];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatChange(percent: number | null) {
  if (percent === null) return null;
  const arrow = percent >= 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(percent).toFixed(0)}%`;
}

export function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const roomId = Number(id);
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await api.getDashboard(roomId, year);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    if (roomId) load();
  }, [roomId, year]);

  const monthlyWithData = data?.monthly.filter((m) => m.total > 0) ?? [];
  const memberData = data?.byMember ?? [];
  const availableYears = data?.availableYears?.length
    ? data.availableYears
    : [currentYear, currentYear - 1, currentYear - 2];
  const yearChange = formatChange(data?.yearChangePercent ?? null);

  const handleBarClick = (monthNum: number, total: number) => {
    if (total > 0) {
      navigate(`/rooms/${roomId}?year=${year}&month=${monthNum}`);
    }
  };

  return (
    <Layout>
      <div className="page-header">
        <div>
          <Link to={`/rooms/${roomId}`} className="back-link">← Back to room</Link>
          <h1>Monthly Dashboard</h1>
          <p className="text-muted">Visual breakdown of room expenses · tap a month to view details</p>
        </div>
        <div className="year-select">
          <label>
            Year
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading-inline"><div className="spinner" /></div>
      ) : data ? (
        <>
          <div className="stat-card card dashboard-total">
            <span className="stat-label">{year} Total Expenses</span>
            <span className="stat-value">{formatCurrency(data.yearTotal)}</span>
            {yearChange && (
              <span className={`change-badge ${(data.yearChangePercent ?? 0) >= 0 ? 'up' : 'down'}`}>
                {yearChange} vs {year - 1}
              </span>
            )}
          </div>

          <div className="charts-grid">
            <div className="card chart-card">
              <h2>Monthly Expenses</h2>
              <p className="text-muted table-hint">Click a bar to open that month&apos;s history</p>
              {monthlyWithData.length === 0 ? (
                <p className="text-muted empty-text">No expenses recorded for {year}</p>
              ) : (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} width={48} />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Total']}
                        contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)' }}
                      />
                      <Bar
                        dataKey="total"
                        fill="#6366f1"
                        radius={[6, 6, 0, 0]}
                        cursor="pointer"
                        onClick={(barData) => {
                          const payload = (barData as { payload?: { monthNum: number; total: number } }).payload;
                          if (payload?.monthNum != null) {
                            handleBarClick(payload.monthNum, payload.total ?? 0);
                          }
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card chart-card">
              <h2>By Roommate</h2>
              {memberData.length === 0 ? (
                <p className="text-muted empty-text">No expenses by members yet</p>
              ) : (
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={memberData}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius="70%"
                        label={({ name, percent }) =>
                          `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {memberData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                      <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2>Monthly Breakdown</h2>
            <p className="text-muted table-hint">Tap a month with expenses to view full history</p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((row) => (
                    <tr key={row.monthNum}>
                      <td>
                        {row.total > 0 ? (
                          <Link
                            to={`/rooms/${roomId}?year=${year}&month=${row.monthNum}`}
                            className="month-link"
                          >
                            {row.month}
                          </Link>
                        ) : (
                          <span className="text-muted">{row.month}</span>
                        )}
                      </td>
                      <td>{formatCurrency(row.total)}</td>
                      <td>
                        {row.total > 0 && (
                          <Link
                            to={`/rooms/${roomId}?year=${year}&month=${row.monthNum}`}
                            className="btn btn-ghost btn-sm"
                          >
                            View →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </Layout>
  );
}
