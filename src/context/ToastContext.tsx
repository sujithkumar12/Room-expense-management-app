import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { ToastMessage, ToastType } from '../types';

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismissToast(id), 3500);
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
