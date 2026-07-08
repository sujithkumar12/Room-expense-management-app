import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Expense, ExpenseSort, Member, MonthOption, Room, RoomSummary, Settlement } from '../types';
import { MdDeleteOutline, MdOutlineContentCopy, MdOutlineModeEdit } from 'react-icons/md';
import { LuLayoutDashboard } from 'react-icons/lu';

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

function getCurrentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function getMonthDateBounds(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function formatChange(percent: number | null) {
  if (percent === null) return null;
  const arrow = percent >= 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(percent).toFixed(0)}%`;
}

export function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const roomId = Number(id);

  const { year: currentYear, month: currentMonth } = getCurrentPeriod();
  const selectedYear = Number(searchParams.get('year')) || currentYear;
  const selectedMonth = Number(searchParams.get('month')) || currentMonth;

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<RoomSummary | null>(null);
  const [availableMonths, setAvailableMonths] = useState<MonthOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showLimitForm, setShowLimitForm] = useState(false);
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [formError, setFormError] = useState('');
  const [limitError, setLimitError] = useState('');
  const [settleError, setSettleError] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklyLimitInput, setWeeklyLimitInput] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settlePayeeId, setSettlePayeeId] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expenseFilter, setExpenseFilter] = useState<'all' | number>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expenseSort, setExpenseSort] = useState<ExpenseSort>('date-desc');

  const loadRoom = async (year: number, month: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getRoom(roomId, year, month);
      setRoom(data.room);
      setMembers(data.members);
      setExpenses(data.expenses);
      setSettlements(data.settlements);
      setSummary(data.summary);
      setAvailableMonths(data.availableMonths);
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
    if (roomId) loadRoom(selectedYear, selectedMonth);
  }, [roomId, selectedYear, selectedMonth]);

  useEffect(() => {
    if (
      expenseFilter !== 'all' &&
      !expenses.some((e) => e.user_id === expenseFilter)
    ) {
      setExpenseFilter('all');
    }
  }, [expenses, expenseFilter]);

  useEffect(() => {
    const modalOpen = showForm || showLimitForm || showSettleForm || expenseToDelete;
    if (!modalOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showForm, showLimitForm, showSettleForm, expenseToDelete]);

  const handleMonthChange = (value: string) => {
    const [year, month] = value.split('-').map(Number);
    setSearchParams({ year: String(year), month: String(month) });
    setExpenseFilter('all');
    setSearchQuery('');
  };

  const copyInviteCode = async () => {
    if (!room) return;
    const text = `Join "${room.name}" on RoomSplit!\nInvite code: ${room.invite_code}\n${window.location.origin}/rooms`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Invite code copied to clipboard', 'success');
    } catch {
      showToast('Could not copy — please copy manually', 'error');
    }
  };

  // const shareInvite = async () => {
  //   if (!room) return;
  //   const text = `Join "${room.name}" on RoomSplit! Use invite code: ${room.invite_code}`;
  //   const url = `${window.location.origin}/rooms`;
  //   try {
  //     if (navigator.share) {
  //       await navigator.share({ title: `Join ${room.name}`, text, url });
  //       showToast('Invite shared', 'success');
  //     } else {
  //       await navigator.clipboard.writeText(`${text}\n${url}`);
  //       showToast('Invite copied (sharing not supported)', 'success');
  //     }
  //   } catch (err) {
  //     if (err instanceof Error && err.name !== 'AbortError') {
  //       showToast('Share cancelled', 'info');
  //     }
  //   }
  // };

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

  const closeSettleForm = () => {
    setShowSettleForm(false);
    setSettleError('');
    setSettleAmount('');
    setSettlePayeeId('');
    setSettleNote('');
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
      const body = { amount: Number(amount), purpose, expenseDate };
      if (editingExpense) {
        await api.updateExpense(editingExpense.id, body);
        showToast('Expense updated', 'success');
      } else {
        await api.addExpense({ roomId, ...body });
        showToast('Expense added', 'success');
      }
      closeForm();
      await loadRoom(selectedYear, selectedMonth);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setSubmitting(true);
    try {
      await api.deleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
      showToast('Expense deleted', 'success');
      await loadRoom(selectedYear, selectedMonth);
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
      showToast('Weekly limit updated', 'success');
      await loadRoom(selectedYear, selectedMonth);
    } catch (err) {
      setLimitError(err instanceof Error ? err.message : 'Failed to set weekly limit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSettlement = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSettleError('');
    try {
      if (!settlePayeeId) {
        setSettleError('Select who you paid');
        return;
      }
      await api.addSettlement({
        roomId,
        payeeId: Number(settlePayeeId),
        amount: Number(settleAmount),
        note: settleNote.trim() || undefined,
        year: selectedYear,
        month: selectedMonth,
      });
      closeSettleForm();
      showToast('Payment recorded', 'success');
      await loadRoom(selectedYear, selectedMonth);
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSettlement = async (settlementId: number) => {
    try {
      await api.deleteSettlement(settlementId);
      showToast('Payment removed', 'success');
      await loadRoom(selectedYear, selectedMonth);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove payment', 'error');
    }
  };

  const filteredExpenses = useMemo(() => {
    let list =
      expenseFilter === 'all'
        ? expenses
        : expenses.filter((e) => e.user_id === expenseFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.purpose.toLowerCase().includes(q) ||
          e.user_name.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      switch (expenseSort) {
        case 'amount-asc':
          return a.amount - b.amount;
        case 'amount-desc':
          return b.amount - a.amount;
        case 'date-asc':
          return a.expense_date.localeCompare(b.expense_date);
        default:
          return b.expense_date.localeCompare(a.expense_date);
      }
    });
  }, [expenses, expenseFilter, searchQuery, expenseSort]);

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

  const expenseCountByMember = (memberId: number) =>
    expenses.filter((e) => e.user_id === memberId).length;

  const tabMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));
  const otherMembers = members.filter((m) => m.id !== user?.id);
  const formDateBounds = editingExpense
    ? getMonthDateBounds(
      new Date(editingExpense.expense_date).getFullYear(),
      new Date(editingExpense.expense_date).getMonth() + 1
    )
    : getMonthDateBounds(summary.selectedYear, summary.selectedMonth);
  const monthPeriodValue = `${summary.selectedYear}-${summary.selectedMonth}`;
  const monthChange = formatChange(summary.monthChangePercent);

  return (
    <Layout>
      <div className="page-header">
        <div>
          <Link to="/rooms" className="back-link">← All rooms</Link>
          <h1>{room.name}</h1>
          <p className="text-muted invite-row">
            Invite code: <strong>{room.invite_code}</strong>
            <span className="invite-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={copyInviteCode}>
              <MdOutlineContentCopy /> Copy
              </button>
              {/* <button type="button" className="btn btn-ghost btn-sm" onClick={shareInvite}>
                📤 Share
              </button> */}
            </span>
          </p>
        </div>
        <div className="page-actions">
          <Link to={`/rooms/${roomId}/dashboard`} className="btn btn-secondary">
          <LuLayoutDashboard /> Dashboard
          </Link>
          {/* <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowSettleForm(true)}
          >
            💸 Settle up
          </button> */}
          {summary.isCurrentMonth && (
            <button
              type="button"
              className={`btn btn-primary${showForm ? ' btn-active' : ''}`}
              onClick={() => (showForm ? closeForm() : openAddForm())}
              aria-expanded={showForm}
            >
              {showForm ? '✕ Close' : '+ Add Expense'}
            </button>
          )}
        </div>
      </div>

      <div className="month-banner card">
        <div className="month-banner-text">
          <span>📅 Showing <strong>{summary.monthLabel}</strong> expenses</span>
          <span className="text-muted">
            {summary.isCurrentMonth
              ? 'Previous months are saved — use the month picker to view history'
              : 'Viewing saved expense history for this month'}
          </span>
        </div>
        <div className="month-picker">
          <label>
            Month
            <select
              value={monthPeriodValue}
              onChange={(e) => handleMonthChange(e.target.value)}
            >
              {availableMonths.map((option) => (
                <option
                  key={`${option.year}-${option.month}`}
                  value={`${option.year}-${option.month}`}
                >
                  {option.label}
                  {option.year === currentYear && option.month === currentMonth
                    ? ' (current)'
                    : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && !showForm && !showLimitForm && !showSettleForm && !expenseToDelete && (
        <div className="alert alert-error">{error}</div>
      )}

      <div className={`stats-grid ${summary.isCurrentMonth ? 'stats-grid-4' : 'stats-grid-3'}`}>
        <div className="stat-card card">
          <span className="stat-label">Monthly Expenses</span>
          <span className="stat-value">{formatCurrency(summary.monthlyExpense)}</span>
          <span className="stat-hint">{summary.monthLabel}</span>
          {monthChange && (
            <span className={`change-badge ${(summary.monthChangePercent ?? 0) >= 0 ? 'up' : 'down'}`}>
              {monthChange} vs {summary.previousMonthLabel}
            </span>
          )}
        </div>

        {summary.isCurrentMonth && (
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
              <button type="button" className="btn btn-ghost btn-sm limit-btn" onClick={openLimitForm}>
                {summary.weeklyLimit ? 'Edit weekly limit' : 'Set weekly limit'}
              </button>
            )}
          </div>
        )}

        <div className="stat-card card">
          <span className="stat-label">Equal Share</span>
          <span className="stat-value accent">{formatCurrency(summary.equalShare)}</span>
          <span className="stat-hint">
            {summary.isCurrentMonth ? 'this month' : summary.monthLabel} · {summary.memberCount} roommate{summary.memberCount !== 1 ? 's' : ''}
          </span>
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
                  {summary.isCurrentMonth ? ' this month' : ` in ${summary.monthLabel}`}
                </span>
              </>
            );
          })()}
        </div>
      </div>

      {settlements.length > 0 && (
        <section className="card settlements-card">
          <h2>Settle-up payments <span className="section-sub">({summary.monthLabel})</span></h2>
          <div className="settlement-list">
            {settlements.map((s) => (
              <div key={s.id} className="settlement-row">
                <div className="settlement-info">
                  <strong>{s.payer_name} → {s.payee_name}</strong>
                  <span className="text-muted">
                    {formatCurrency(s.amount)}
                    {s.note ? ` · ${s.note}` : ''}
                    {' · '}{formatDate(s.created_at)}
                  </span>
                </div>
                {s.payer_id === user?.id && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteSettlement(s.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showSettleForm && (
        <div className="expense-modal-backdrop" onClick={closeSettleForm} role="presentation">
          <div className="expense-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="expense-modal-header">
              <div>
                <h3>Record payment</h3>
                <p className="expense-modal-hint">
                  Log a settle-up payment for {summary.monthLabel}. This adjusts balances for the month.
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeSettleForm} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleAddSettlement} className="expense-form">
              {settleError && <div className="alert alert-error">{settleError}</div>}
              <label>
                <span className="field-label">Paid to</span>
                <select
                  value={settlePayeeId}
                  onChange={(e) => setSettlePayeeId(e.target.value)}
                  required
                >
                  <option value="">Select roommate</option>
                  {otherMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Amount (₹)</span>
                <input
                  type="number"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  min="1"
                  step="0.01"
                  required
                  autoFocus
                />
              </label>
              <label>
                <span className="field-label">Note (optional)</span>
                <input
                  type="text"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  placeholder="UPI, cash, etc."
                  maxLength={500}
                />
              </label>
              <div className="form-actions expense-modal-actions">
                <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Record payment'}
                </button>
                <button type="button" className="btn btn-secondary btn-full" onClick={closeSettleForm}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLimitForm && room.is_admin && (
        <div className="expense-modal-backdrop" onClick={closeLimitForm} role="presentation">
          <div className="expense-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="expense-modal-header">
              <div>
                <h3>Weekly Expense Limit</h3>
                <p className="expense-modal-hint">
                  Set a max spend for the room each week. Resets every Monday.
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeLimitForm} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleSetWeeklyLimit} className="expense-form">
              {limitError && <div className="alert alert-error">{limitError}</div>}
              <label>
                <span className="field-label">Weekly limit (₹)</span>
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
          <div className="expense-modal confirm-modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon">🗑️</div>
            <h3>Delete expense?</h3>
            <p className="confirm-modal-text">
              Delete <strong>{expenseToDelete.purpose}</strong> ({formatCurrency(expenseToDelete.amount)})?
            </p>
            <div className="form-actions expense-modal-actions">
              <button type="button" className="btn btn-danger btn-full" onClick={confirmDeleteExpense} disabled={submitting}>
                {submitting ? 'Deleting...' : 'Yes, delete'}
              </button>
              <button type="button" className="btn btn-secondary btn-full" onClick={() => setExpenseToDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="expense-modal-backdrop" onClick={closeForm} role="presentation">
          <div className="expense-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="expense-modal-header">
              <div>
                <h3>{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
                <p className="expense-modal-hint">
                  {editingExpense
                    ? `Update your expense from ${summary.monthLabel}.`
                    : 'Fill in what you paid. All roommates will see this expense.'}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={closeForm} aria-label="Close">✕</button>
            </div>
            <form onSubmit={handleSaveExpense} className="expense-form">
              {formError && <div className="alert alert-error">{formError}</div>}
              <label>
                <span className="field-label">Amount (₹)</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" step="0.01" required autoFocus />
              </label>
              <label>
                <span className="field-label">Purpose</span>
                <input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} required maxLength={500} />
              </label>
              <label>
                <span className="field-label">Date</span>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  min={formDateBounds.start}
                  max={formDateBounds.end}
                  required
                />
              </label>
              <div className="form-actions expense-modal-actions">
                <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                  {submitting ? 'Saving...' : editingExpense ? 'Update expense' : 'Save expense'}
                </button>
                <button type="button" className="btn btn-secondary btn-full" onClick={closeForm}>Cancel</button>
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
                    <span className="text-muted">
                      Paid {formatCurrency(member.totalPaid)}
                      {(member.settledPaid ?? 0) > 0 && ` · Settled ${formatCurrency(member.settledPaid!)}`}
                    </span>
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
          <h2>{summary.isCurrentMonth ? "This Month's Expenses" : `${summary.monthLabel} Expenses`}</h2>

          {expenses.length > 0 && (
            <>
              <div className="expense-toolbar">
                <input
                  type="search"
                  className="search-input"
                  placeholder="Search by purpose or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search expenses"
                />
                <select
                  className="sort-select"
                  value={expenseSort}
                  onChange={(e) => setExpenseSort(e.target.value as ExpenseSort)}
                  aria-label="Sort expenses"
                >
                  <option value="date-desc">Newest first</option>
                  <option value="date-asc">Oldest first</option>
                  <option value="amount-desc">Amount: high to low</option>
                  <option value="amount-asc">Amount: low to high</option>
                </select>
              </div>
              <div className="expense-tabs" role="tablist" aria-label="Filter expenses by member">
                <button
                  type="button"
                  role="tab"
                  className={`expense-tab${expenseFilter === 'all' ? ' active' : ''}`}
                  onClick={() => setExpenseFilter('all')}
                >
                  All
                  <span className="tab-count">{expenses.length}</span>
                </button>
                {tabMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    role="tab"
                    className={`expense-tab${expenseFilter === member.id ? ' active' : ''}`}
                    onClick={() => setExpenseFilter(member.id)}
                  >
                    {member.name.split(' ')[0]}
                    <span className="tab-count">{expenseCountByMember(member.id)}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {expenses.length === 0 ? (
            <p className="text-muted empty-text">
              {summary.isCurrentMonth
                ? 'No expenses this month. Add the first one!'
                : `No expenses recorded for ${summary.monthLabel}.`}
            </p>
          ) : filteredExpenses.length === 0 ? (
            <p className="text-muted empty-text">No expenses match your search or filter.</p>
          ) : (
            <div className="expense-list">
              {filteredExpenses.map((expense) => (
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
                        <button type="button" className="btn-icon" onClick={() => openEditForm(expense)} aria-label="Edit"><MdOutlineModeEdit /></button>
                        <button type="button" className="btn-icon btn-icon-danger" onClick={() => setExpenseToDelete(expense)} aria-label="Delete"><MdDeleteOutline /></button>
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
