import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname.startsWith(path);
  const initial = user?.name?.charAt(0).toUpperCase() ?? '?';

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showLogoutConfirm) setShowLogoutConfirm(false);
      else if (menuOpen) setMenuOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [menuOpen, showLogoutConfirm]);

  useEffect(() => {
    if (!showLogoutConfirm) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showLogoutConfirm]);

  const handleLogoutClick = () => {
    setMenuOpen(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/rooms" className="brand">
          <span className="brand-icon">🏠</span>
          RoomSplit
        </Link>
        <nav className="nav-links">
          <Link to="/rooms" className={isActive('/rooms') && !location.pathname.includes('/dashboard') ? 'active' : ''}>
            Rooms
          </Link>
        </nav>
        <div className="header-user" ref={menuRef}>
          <button
            type="button"
            className={`profile-btn${menuOpen ? ' open' : ''}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Profile menu"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <span className="profile-avatar">{initial}</span>
          </button>
          {menuOpen && (
            <div className="profile-menu" role="menu">
              <div className="profile-menu-header">
                <span className="profile-menu-avatar">{initial}</span>
                <div className="profile-menu-info">
                  <span className="profile-menu-name">{user?.name}</span>
                  <span className="profile-menu-email">{user?.email}</span>
                </div>
              </div>
              <button
                type="button"
                className="profile-menu-item"
                role="menuitem"
                onClick={handleLogoutClick}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="app-main">{children}</main>

      {showLogoutConfirm && (
        <div
          className="expense-modal-backdrop"
          onClick={() => setShowLogoutConfirm(false)}
          role="presentation"
        >
          <div
            className="expense-modal confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-modal-icon">👋</div>
            <h3 id="logout-modal-title">Log out?</h3>
            <p className="confirm-modal-text">
              Are you sure you want to log out of <strong>{user?.name}</strong>?
            </p>
            <div className="form-actions expense-modal-actions">
              <button type="button" className="btn btn-danger btn-full" onClick={confirmLogout}>
                Yes, log out
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
