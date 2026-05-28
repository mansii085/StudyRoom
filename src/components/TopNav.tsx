import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LogOut, User, BarChart2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

interface TopNavProps {
  roomName?: string;
  hostedBy?: string;
  onLeave?: () => void;
}

export function TopNav({ roomName, hostedBy, onLeave }: TopNavProps) {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

  const handleSignOut = async () => {
    await signOut();
    setLocation('/login');
  };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: 'var(--sr-nav-height)',
      background: 'var(--sr-glass-surface)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--sr-glass-border)',
      display: 'flex', alignItems: 'center',
      padding: '0 var(--sr-space-6)',
      zIndex: 'var(--sr-z-nav)' as any,
      gap: 16,
    }}>
      {/* Left cluster */}
      <Link href="/" className="sr-nav-link" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0, marginLeft: -12 }}>
        <Logo style={{ width: 22, height: 22, color: 'var(--sr-accent)' }} />
        <span style={{ fontSize: 'var(--sr-text-lg)', fontWeight: 600, color: 'var(--sr-fg-1)' }}>
          Study Rooms
        </span>
      </Link>

      {/* Center */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {roomName && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--sr-text-base)', fontWeight: 600, color: 'var(--sr-fg-1)' }}>
              {roomName}
            </div>
            {hostedBy && (
              <div style={{ fontSize: 'var(--sr-text-xs)', color: 'var(--sr-fg-3)' }}>
                Hosted by {hostedBy}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {onLeave && (
          <button
            onClick={onLeave}
            data-testid="button-leave-room"
            style={{
              background: 'transparent',
              border: '1px solid var(--sr-border)',
              borderRadius: 'var(--sr-radius-md)',
              padding: '0 12px',
              height: 32,
              fontSize: 'var(--sr-text-base)',
              color: 'var(--sr-danger)',
              cursor: 'pointer',
              fontWeight: 500,
              transition: `background var(--sr-duration-fast) var(--sr-ease-out)`,
            }}
          >
            Leave room
          </button>
        )}

        <Link
          href="/dashboard"
          data-testid="link-dashboard"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 'var(--sr-radius-md)',
            color: 'var(--sr-fg-2)', textDecoration: 'none',
            transition: `background var(--sr-duration-fast)`,
          }}
          title="Dashboard"
        >
          <BarChart2 size={20} />
        </Link>



        {/* Avatar/menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            data-testid="button-user-menu"
            style={{
              width: 32, height: 32, borderRadius: 'var(--sr-radius-full)',
              background: 'var(--sr-accent-soft)',
              border: '1.5px solid var(--sr-accent)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--sr-accent)',
              fontSize: 13, fontWeight: 600,
            }}
          >
            {profile?.display_name?.charAt(0).toUpperCase() || <User size={14} />}
          </button>

          {menuOpen && (
            <>
              <div
                onClick={() => setMenuOpen(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 'var(--sr-z-overlay)' as any,
                }}
              />
              <div style={{
                position: 'absolute', top: 40, right: 0,
                background: 'var(--sr-surface-raised)',
                border: '1px solid var(--sr-border)',
                borderRadius: 'var(--sr-radius-lg)',
                boxShadow: 'var(--sr-shadow-md)',
                padding: '4px',
                minWidth: 180,
                zIndex: 'var(--sr-z-modal)' as any,
              }}>
                <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--sr-border)', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sr-fg-1)' }}>{profile?.display_name}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  data-testid="button-sign-out"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 12px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderRadius: 'var(--sr-radius-md)',
                    color: 'var(--sr-danger)', fontSize: 14, fontWeight: 500,
                  }}
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
