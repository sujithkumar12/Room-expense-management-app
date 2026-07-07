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
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showLimitForm, setShowLimitForm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [formError, setFormError] = useState('');
  const [limitError, setLimitError] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklyLimitInput, setWeeklyLimitInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRoom = async () => {
    try {
      const data = await api.getRoom(roomId);
      setRoom(data.room);
      setMembers(data.members);
      setExpenses(data.expenses);
      setSummary(data.summary);
      setWeeklyLimitInput(
        data.summary.weeklyLimit != null ? String(data.summary.weeklyLimit) : ''
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load room');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (roomId) loadRoom();
  }, [roomId]);

  useEffect(() => {
    const modalOpen = showForm || showLimitForm || expenseToDelete;
    if (!modalOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showForm, showLimitForm, expenseToDelete]);

  const closeForm = () => {
    setShowForm(false);
    setEditingExpense(null);
    setAmount('');
    setPurpose('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setFormError('');
  };

  const closeLimitForm = () => {
    setShowLimitForm(false);
    setLimitError('');
    if (summary?.weeklyLimit != null) {
      setWeeklyLimitInput(String(summary.weeklyLimit));
    } else {
      setWeeklyLimitInput('');
    }
  };

  const openLimitForm = () => {
    setLimitError('');
    setWeeklyLimitInput(
      summary?.weeklyLimit != null ? String(summary.weeklyLimit) : ''
    );
    setShowLimitForm(true);
  };

  const openAddForm = () => {
    setEditingExpense(null);
    setAmount('');
    setPurpose('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingExpense(expense);
    setAmount(String(expense.amount));
    setPurpose(expense.purpose);
    setExpenseDate(expense.expense_date.split('T')[0]);
    setShowForm(true);
  };

  const handleSaveExpense = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      const body = {
        amount: Number(amount),
        purpose,
        expenseDate,
      };

      if (editingExpense) {
        await api.updateExpense(editingExpense.id, body);
      } else {
        await api.addExpense({ roomId, ...body });
      }

      closeForm();
      await loadRoom();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setSubmitting(true);
    setError('');
    try {
      await api.deleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
      await loadRoom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
      setExpenseToDelete(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetWeeklyLimit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLimitError('');
    try {
      const limit = weeklyLimitInput.trim() === '' ? null : Number(weeklyLimitInput);
      if (limit !== null && (Number.isNaN(limit) || limit <= 0)) {
        setLimitError('Weekly limit must be a positive number');
        return;
      }
      await api.setWeeklyLimit(roomId, limit);
      closeLimitForm();
      await loadRoom();
    } catch (err) {
      setLimitError(err instanceof Error ? err.message : 'Failed to set weekly limit');
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

  const weeklyPercent = summary.weeklyLimit
    ? Math.min((summary.weeklyExpense / summary.weeklyLimit) * 100, 100)
    : 0;
  const weeklyOver = summary.weeklyLimit
    ? summary.weeklyExpense > summary.weeklyLimit
    : false;

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
          <button
            type="button"
            className={`btn btn-primary${showForm ? ' btn-active' : ''}`}
            onClick={() => (showForm ? closeForm() : openAddForm())}
            aria-expanded={showForm}
          >
            {showForm ? '✕ Close' : '+ Add Expense'}
          </button>
        </div>
      </div>

      <div className="month-banner card">
        <span>📅 Showing <strong>{summary.monthLabel}</strong> expenses</span>
        <span className="text-muted">Resets automatically on the 1st of each month</span>
      </div>

      {error && !showForm && !showLimitForm && !expenseToDelete && (
        <div className="alert alert-error">{error}</div>
      )}

      <div className="stats-grid stats-grid-4">
        <div className="stat-card card">
          <span className="stat-label">Monthly Expenses</span>
          <span className="stat-value">{formatCurrency(summary.monthlyExpense)}</span>
          <span className="stat-hint">{summary.monthLabel}</span>
        </div>

        <div className="stat-card card">
          <span className="stat-label">Weekly Spend</span>
          <span className={`stat-value ${weeklyOver ? 'negative' : ''}`}>
            {formatCurrency(summary.weeklyExpense)}
          </span>
          {summary.weeklyLimit ? (
            <>
              <span className="stat-hint">
                of {formatCurrency(summary.weeklyLimit)} limit · resets Monday
              </span>
              <div className="progress-bar">
                <div
                  className={`progress-fill${weeklyOver ? ' over' : ''}`}
                  style={{ width: `${weeklyPercent}%` }}
                />
              </div>
            </>
          ) : (
            <span className="stat-hint">No weekly limit set</span>
          )}
          {room.is_admin && (
            <button
              type="button"
              className="btn btn-ghost btn-sm limit-btn"
              onClick={openLimitForm}
            >
              {summary.weeklyLimit ? 'Edit weekly limit' : 'Set weekly limit'}
            </button>
          )}
        </div>

        <div className="stat-card card">
          <span className="stat-label">Equal Share</span>
          <span className="stat-value accent">{formatCurrency(summary.equalShare)}</span>
          <span className="stat-hint">this month · {summary.memberCount} roommate{summary.memberCount !== 1 ? 's' : ''}</span>
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
                  {balance > 0 ? 'You are owed' : balance < 0 ? 'You owe' : 'All settled'} this month
                </span>
              </>
            );
          })()}
        </div>
      </div>

      {showLimitForm && room.is_admin && (
        <div className="expense-modal-backdrop" onClick={closeLimitForm} role="presentation">
          <div
            className="expense-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="limit-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="expense-modal-header">
              <div>
                <h3 id="limit-modal-title">Weekly Expense Limit</h3>
                <p className="expense-modal-hint">
                  Set a max spend for the room each week. Resets every Monday. Only you (admin) can change this.
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeLimitForm} aria-label="Close">
                ✕
              </button>
            </div>

            <form onSubmit={handleSetWeeklyLimit} className="expense-form">
              {limitError && <div className="alert alert-error">{limitError}</div>}
              <label>
                <span className="field-label">Weekly limit (₹)</span>
                <span className="field-hint">Leave empty to remove the limit</span>
                <input
                  type="number"
                  value={weeklyLimitInput}
                  onChange={(e) => setWeeklyLimitInput(e.target.value)}
                  placeholder="e.g. 5000"
                  min="1"
                  step="1"
                  autoFocus
                />
              </label>
              <div className="form-actions expense-modal-actions">
                <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save limit'}
                </button>
                <button type="button" className="btn btn-secondary btn-full" onClick={closeLimitForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {expenseToDelete && (
        <div className="expense-modal-backdrop" onClick={() => setExpenseToDelete(null)} role="presentation">
          <div
            className="expense-modal confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-modal-icon">🗑️</div>
            <h3 id="delete-modal-title">Delete expense?</h3>
            <p className="confirm-modal-text">
              Are you sure you want to delete <strong>{expenseToDelete.purpose}</strong> (
              {formatCurrency(expenseToDelete.amount)})? This cannot be undone.
            </p>
            <div className="form-actions expense-modal-actions">
              <button
                type="button"
                className="btn btn-danger btn-full"
                onClick={confirmDeleteExpense}
                disabled={submitting}
              >
                {submitting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={() => setExpenseToDelete(null)}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="expense-modal-backdrop" onClick={closeForm} role="presentation">
          <div
            className="expense-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="expense-modal-header">
              <div>
                <h3 id="expense-modal-title">
                  {editingExpense ? 'Edit Expense' : 'Add Expense'}
                </h3>
                <p className="expense-modal-hint">
                  {editingExpense
                    ? 'Update your expense for this month.'
                    : 'Fill in what you paid. All roommates will see this expense.'}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeForm} aria-label="Close form">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="expense-form">
              {formError && <div className="alert alert-error">{formError}</div>}
              <label>
                <span className="field-label">Amount (₹)</span>
                <span className="field-hint">How much did you spend?</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 500"
                  min="1"
                  step="0.01"
                  required
                  autoFocus
                />
              </label>
              <label>
                <span className="field-label">Purpose</span>
                <span className="field-hint">What was this expense for?</span>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Groceries, Electricity, WiFi..."
                  required
                  maxLength={500}
                />
              </label>
              <label>
                <span className="field-label">Date</span>
                <span className="field-hint">Must be in the current month</span>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </label>
              <div className="form-actions expense-modal-actions">
                <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                  {submitting ? 'Saving...' : editingExpense ? 'Update expense' : 'Save expense'}
                </button>
                <button type="button" className="btn btn-secondary btn-full" onClick={closeForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="two-col">
        <section className="card">
          <h2>Roommates <span className="section-sub">({summary.monthLabel})</span></h2>
          <div className="member-list">
            {members.map((member) => (
              <div key={member.id} className="member-row">
                <div className="member-info">
                  <span className="member-avatar">{member.name.charAt(0).toUpperCase()}</span>
                  <div>
                    <strong>{member.name}{member.id === user?.id ? ' (you)' : ''}</strong>
                    <span className="text-muted">Paid {formatCurrency(member.totalPaid)} this month</span>
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
          <h2>This Month&apos;s Expenses</h2>
          {expenses.length === 0 ? (
            <p className="text-muted empty-text">No expenses this month. Add the first one!</p>
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
                  <div className="expense-actions">
                    <span className="expense-amount">{formatCurrency(expense.amount)}</span>
                    {expense.user_id === user?.id && (
                      <div className="expense-btns">
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => openEditForm(expense)}
                          aria-label="Edit expense"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-icon-danger"
                          onClick={() => setExpenseToDelete(expense)}
                          aria-label="Delete expense"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
