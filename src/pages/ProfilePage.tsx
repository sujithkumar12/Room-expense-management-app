import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [upiId, setUpiId] = useState(user?.upiId ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    api
      .getProfile()
      .then(({ user: profile }) => {
        setName(profile.name);
        setUpiId(profile.upiId ?? '');
        setEmail(profile.email);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { user: updated } = await api.updateProfile({
        name: name.trim(),
        upiId: upiId.trim() || null,
      });
      updateUser(updated);
      showToast('Profile updated', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully', 'success');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading-inline"><div className="spinner" /></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <Link to="/rooms" className="back-link">← Back to rooms</Link>
          <h1>Profile</h1>
          <p className="text-muted">Manage your account, UPI ID, and password</p>
        </div>
      </div>

      <div className="profile-grid">
        <div className="card profile-card">
          <div className="profile-hero">
            <span className="profile-hero-avatar">{name.charAt(0).toUpperCase()}</span>
            <div>
              <strong>{name}</strong>
              <span className="text-muted">{email}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="profile-form">
            {error && <div className="alert alert-error">{error}</div>}

            <label>
              <span className="field-label">Display name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={255}
              />
            </label>

            <label>
              <span className="field-label">Email</span>
              <input type="email" value={email} disabled />
              <span className="field-hint">Email cannot be changed</span>
            </label>

            <label>
              <span className="field-label">UPI ID</span>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourname@upi or 9876543210"
                autoComplete="off"
              />
              <span className="field-hint">
                Roommates can pay you directly via UPI when you are owed money
              </span>
            </label>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        </div>

        <div className="card profile-password-card">
          <h3 className="profile-section-title">Change password</h3>
          <p className="text-muted profile-section-desc">
            Use a strong password you do not use elsewhere.
          </p>

          <form onSubmit={handleChangePassword} className="profile-form">
            {passwordError && <div className="alert alert-error">{passwordError}</div>}

            <label>
              <span className="field-label">Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>

            <label>
              <span className="field-label">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>

            <label>
              <span className="field-label">Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </label>

            <button type="submit" className="btn btn-secondary" disabled={changingPassword}>
              {changingPassword ? 'Updating...' : 'Change password'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
