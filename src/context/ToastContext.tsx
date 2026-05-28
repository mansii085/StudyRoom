import { createContext, useContext, useState, useCallback } from 'react';
import { X, Info, CheckCircle2, AlertCircle } from 'lucide-react';

type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  body?: string;
}

interface ToastContextType {
  toast: (opts: { variant: ToastVariant; title: string; body?: string }) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

const icons: Record<ToastVariant, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: AlertCircle,
};

const borderColors: Record<ToastVariant, string> = {
  info: 'var(--sr-info)',
  success: 'var(--sr-success)',
  warning: 'var(--sr-warning)',
  error: 'var(--sr-danger)',
};

const iconColors: Record<ToastVariant, string> = {
  info: 'var(--sr-info)',
  success: 'var(--sr-success)',
  warning: 'var(--sr-warning)',
  error: 'var(--sr-danger)',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(({ variant, title, body }: { variant: ToastVariant; title: string; body?: string }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, variant, title, body }]);
    const delay = variant === 'error' ? 8000 : 4000;
    setTimeout(() => dismiss(id), delay);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 'var(--sr-z-toast)' as any, display: 'flex', flexDirection: 'column', gap: 12, width: 360, maxWidth: 'calc(100vw - 48px)' }}>
        {toasts.map(t => {
          const Icon = icons[t.variant];
          return (
            <div
              key={t.id}
              style={{
                background: 'var(--sr-surface-raised)',
                border: '1px solid var(--sr-border)',
                borderLeft: `3px solid ${borderColors[t.variant]}`,
                borderRadius: 'var(--sr-radius-lg)',
                padding: '12px 16px',
                boxShadow: 'var(--sr-shadow-md)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                animation: 'toastSlideUp 200ms var(--sr-ease-out)',
              }}
            >
              <Icon size={20} style={{ color: iconColors[t.variant], flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--sr-fg-1)' }}>{t.title}</div>
                {t.body && <div style={{ fontSize: 13, color: 'var(--sr-fg-2)', marginTop: 2 }}>{t.body}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sr-fg-3)', padding: 0, flexShrink: 0 }}>
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
