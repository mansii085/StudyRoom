import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { RouteGuard } from '@/components/RouteGuard';
import { PENDING_INVITE_KEY } from '@/pages/Join';
import { Logo } from '@/components/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hovered, setHovered] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setErrorMsg('Your email has not been confirmed yet. Check your inbox for a verification link.');
      } else if (error.message.toLowerCase().includes('invalid login credentials')) {
        setErrorMsg('Wrong email or password. Double-check and try again.');
      } else {
        setErrorMsg(error.message);
      }
      return;
    }
    // Honor a pending invite if one was stashed before login
    const pendingInvite = sessionStorage.getItem(PENDING_INVITE_KEY);
    if (pendingInvite) {
      sessionStorage.removeItem(PENDING_INVITE_KEY);
      setLocation(`/join/${pendingInvite}`);
    } else {
      setLocation('/');
    }
  };

  return (
    <RouteGuard requireAuth={false}>
      <div style={{
        minHeight: '100vh', background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--sr-space-5)',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            justifyContent: 'center', marginBottom: 'var(--sr-space-7)',
          }}>
            <Logo style={{ width: 28, height: 28, color: 'var(--sr-accent)' }} />
            <span style={{ fontSize: 'var(--sr-text-xl)', fontWeight: 700, color: 'var(--sr-fg-1)' }}>Study Rooms</span>
          </div>

          <div 
            className="sr-glass sr-nodes" 
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              padding: 'var(--sr-space-6)',
              borderColor: hovered ? 'var(--sr-accent)' : 'var(--sr-glass-border)',
              boxShadow: hovered ? '0 0 15px var(--sr-accent-soft)' : 'var(--sr-glass-shadow)',
              transition: 'all var(--sr-duration-fast) var(--sr-ease-out)',
          }}>
            <h1 style={{
              fontSize: 'var(--sr-text-2xl)', fontWeight: 700,
              color: 'var(--sr-fg-1)', marginBottom: 8,
              letterSpacing: 'var(--sr-tracking-tight)',
            }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 'var(--sr-text-base)', color: 'var(--sr-fg-2)', marginBottom: 'var(--sr-space-6)' }}>
              Sign in to your account to continue studying.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sr-space-4)' }}>
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  data-testid="input-email"
                  style={fieldStyle}
                  className="sr-network-input"
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  data-testid="input-password"
                  style={fieldStyle}
                  className="sr-network-input"
                />
              </Field>

              {errorMsg && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--sr-danger-soft)',
                  border: '1px solid var(--sr-danger)',
                  borderRadius: 'var(--sr-radius-md)',
                  fontSize: 13, color: 'var(--sr-danger)', lineHeight: 1.5,
                }}>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                data-testid="button-sign-in"
                className="sr-network-button"
                style={{
                  height: 44,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading && <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p style={{ marginTop: 'var(--sr-space-5)', textAlign: 'center', fontSize: 14, color: 'var(--sr-fg-2)' }}>
              Don't have an account?{' '}
              <Link href="/signup" style={{ color: 'var(--sr-accent)', textDecoration: 'none', fontWeight: 500 }}>
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 12px',
  color: 'var(--sr-fg-1)', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 'var(--sr-text-xs)', fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: 'var(--sr-tracking-caps)',
        color: 'var(--sr-fg-2)', marginBottom: 8,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
