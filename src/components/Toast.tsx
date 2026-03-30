import { useState, useCallback } from 'react';
import type { ToastMessage } from '../types';

interface UseToastReturn {
  toasts: ToastMessage[];
  showToast: (type: 'success' | 'error', message: string) => void;
  dismissToast: (id: string) => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const toast: ToastMessage = { id, type, message };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  return { toasts, showToast, dismissToast };
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
}

export function ToastContainer({ toasts, dismissToast }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded border shadow-xl
            ${
              toast.type === 'success'
                ? 'bg-card border-positive/30 border-l-2 border-l-positive'
                : 'bg-card border-negative/30 border-l-2 border-l-negative'
            }`}
          style={{
            animation: 'slideInFromRight 0.3s ease-out forwards',
          }}
        >
          <span className={`text-xs font-bold ${toast.type === 'success' ? 'text-positive' : 'text-negative'}`}>
            {toast.type === 'success' ? '✓' : '!'}
          </span>
          <p className="flex-1 text-sm font-medium text-text-primary">
            {toast.message}
          </p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="text-text-dim hover:text-text-secondary text-sm font-bold leading-none ml-1"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
