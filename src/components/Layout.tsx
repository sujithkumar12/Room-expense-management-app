import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

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
        <div className="header-user">
          <span className="user-name">{user?.name}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
