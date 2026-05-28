import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';

interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function RouteGuard({ children, requireAuth = true }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    if (requireAuth && !user) {
      setLocation('/login');
    } else if (!requireAuth && user) {
      setLocation('/');
    }
  }, [user, loading, requireAuth, setLocation]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '2px solid var(--sr-border)',
            borderTopColor: 'var(--sr-accent)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (requireAuth && !user) return null;
  if (!requireAuth && user) return null;

  return <>{children}</>;
}
