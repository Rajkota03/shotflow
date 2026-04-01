"use client";
import { useState, useEffect, useCallback, createContext, useContext } from "react";

type ToastType = "info" | "success" | "warning" | "error";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  undoAction?: () => void;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, opts?: { duration?: number; undoAction?: () => void }) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((
    message: string,
    type: ToastType = "info",
    opts?: { duration?: number; undoAction?: () => void }
  ) => {
    const id = Math.random().toString(36).slice(2);
    const duration = opts?.undoAction ? 10000 : (opts?.duration ?? 4000);
    setToasts((prev) => [...prev, { id, message, type, duration, undoAction: opts?.undoAction }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const duration = t.type === "error" ? 8000 : (t.duration || 4000);
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [t, onDismiss]);

  return (
    <div className={`sf-toast ${t.type}`}>
      <span>{t.message}</span>
      {t.undoAction && (
        <button
          className="btn btn-ghost"
          style={{ height: 28, padding: '0 8px', fontSize: 'var(--text-xs)' }}
          onClick={() => { t.undoAction?.(); onDismiss(); }}
        >
          Undo
        </button>
      )}
      <button
        className="btn btn-ghost"
        style={{ height: 28, padding: '0 4px', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  );
}
