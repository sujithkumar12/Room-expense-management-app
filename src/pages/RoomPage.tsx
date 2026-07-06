import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import type { Expense, Member, Room, RoomSummary } from '../types';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const roomId = Number(id);

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<RoomSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const loadRoom = async () => {
    try {
      const data = await api.getRoom(roomId);
      setRoom(data.room);
      setMembers(data.members);
      setExpenses(data.expenses);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (roomId) loadRoom();
  }, [roomId]);

  const handleAddExpense = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.addExpense({
        roomId,
        amount: Number(amount),
        purpose,
        expenseDate,
      });
      setAmount('');
      setPurpose('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      setShowForm(false);
      await loadRoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading-inline"><div className="spinner" /></div>
      </Layout>
    );
  }

  if (!room || !summary) {
    return (
      <Layout>
        <div className="alert alert-error">{error || 'Room not found'}</div>
        <Link to="/rooms" className="btn btn-secondary">← Back to rooms</Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <Link to="/rooms" className="back-link">← All rooms</Link>
          <h1>{room.name}</h1>
          <p className="text-muted">
            Invite code: <strong>{room.invite_code}</strong> · Share with roommates to join
          </p>
        </div>
        <div className="page-actions">
          <Link to={`/rooms/${roomId}/dashboard`} className="btn btn-secondary">
            📊 Dashboard
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Add Expense
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card card">
          <span className="stat-label">Total Expenses</span>
          <span className="stat-value">{formatCurrency(summary.totalExpense)}</span>
        </div>
        <div className="stat-card card">
          <span className="stat-label">Equal Share</span>
          <span className="stat-value accent">{formatCurrency(summary.equalShare)}</span>
          <span className="stat-hint">per {summary.memberCount} roommate{summary.memberCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="stat-card card">
          <span className="stat-label">Your Balance</span>
          {(() => {
            const me = members.find((m) => m.id === user?.id);
            const balance = me?.balance ?? 0;
            return (
              <>
                <span className={`stat-value ${balance >= 0 ? 'positive' : 'negative'}`}>
                  {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
                </span>
                <span className="stat-hint">
                  {balance > 0 ? 'You are owed' : balance < 0 ? 'You owe' : 'All settled'}
                </span>
              </>
            );
          })()}
        </div>
      </div>

      {showForm && (
        <div className="card form-card">
          <h3>Add new expense</h3>
          <form onSubmit={handleAddExpense} className="expense-form">
            <div className="form-row">
              <label>
                Amount (₹)
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  min="1"
                  step="0.01"
                  required
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </label>
            </div>
            <label>
              Purpose
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Groceries, Electricity bill, WiFi"
                required
                maxLength={500}
              />
            </label>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save expense'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="two-col">
        <section className="card">
          <h2>Roommates</h2>
          <div className="member-list">
            {members.map((member) => (
              <div key={member.id} className="member-row">
                <div className="member-info">
                  <span className="member-avatar">{member.name.charAt(0).toUpperCase()}</span>
                  <div>
                    <strong>{member.name}{member.id === user?.id ? ' (you)' : ''}</strong>
                    <span className="text-muted">Paid {formatCurrency(member.totalPaid)}</span>
                  </div>
                </div>
                <span className={`balance-badge ${member.balance >= 0 ? 'positive' : 'negative'}`}>
                  {member.balance >= 0 ? '+' : ''}{formatCurrency(member.balance)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>All Expenses</h2>
          {expenses.length === 0 ? (
            <p className="text-muted empty-text">No expenses yet. Add the first one!</p>
          ) : (
            <div className="expense-list">
              {expenses.map((expense) => (
                <div key={expense.id} className="expense-row">
                  <div className="expense-info">
                    <strong>{expense.purpose}</strong>
                    <span className="text-muted">
                      {expense.user_name} · {formatDate(expense.expense_date)}
                    </span>
                  </div>
                  <span className="expense-amount">{formatCurrency(expense.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
