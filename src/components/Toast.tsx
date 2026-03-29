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
          className={`flex items-start gap-3 px-4 py-3 rounded-md shadow-lg border-l-4 animate-slide-in
            ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-500'
                : 'bg-red-50 border-red-500'
            }`}
          style={{
            animation: 'slideInFromRight 0.3s ease-out forwards',
          }}
        >
          <span className="text-lg leading-none">
            {toast.type === 'success' ? '✅' : '❌'}
          </span>
          <p
            className={`flex-1 text-sm font-medium ${
              toast.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {toast.message}
          </p>
          <button
            onClick={() => dismissToast(toast.id)}
            className={`text-xs font-bold leading-none ml-1 ${
              toast.type === 'success'
                ? 'text-green-600 hover:text-green-800'
                : 'text-red-600 hover:text-red-800'
            }`}
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
