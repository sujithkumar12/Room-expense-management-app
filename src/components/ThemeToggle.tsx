import { MdOutlineDarkMode, MdOutlineLightMode } from 'react-icons/md';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark mode'}
      style={{ color: isDark ? '#fff' : '#000' }}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? <MdOutlineLightMode /> : <MdOutlineDarkMode />        }
      </span>
    </button>
  );
}
