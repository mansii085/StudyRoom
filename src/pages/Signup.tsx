import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { RouteGuard } from '@/components/RouteGuard';
import { Logo } from '@/components/Logo';
import { PENDING_INVITE_KEY } from '@/pages/Join';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [hovered, setHovered] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMsg('Display name is required.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (error) {
      setLoading(false);
      if (error.message.toLowerCase().includes('rate limit')) {
        setErrorMsg('Email rate limit reached. Please wait a few minutes and try again.');
      } else {
        setErrorMsg(error.message);
      }
      return;
    }
    if (data.user && !data.session) {
      setLoading(false);
      setInfoMsg('Check your inbox for a confirmation email and click the link to activate your account.');
      return;
    }
    if (data.user && data.session) {
      // Email confirmation disabled — logged in immediately
      await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: displayName.trim(),
      });
      toast({ variant: 'success', title: 'Account created', body: 'Welcome to Study Rooms!' });
      const pendingInvite = sessionStorage.getItem(PENDING_INVITE_KEY);
      if (pendingInvite) {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        setLocation(`/join/${pendingInvite}`);
      } else {
        setLocation('/');
      }
    }
    setLoading(false);
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
              Create account
            </h1>
            <p style={{ fontSize: 'var(--sr-text-base)', color: 'var(--sr-fg-2)', marginBottom: 'var(--sr-space-6)' }}>
              Join Study Rooms and find your focus.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sr-space-4)' }}>
              <Field label="Display name">
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                  placeholder="Maya"
                  data-testid="input-display-name"
                  style={fieldStyle}
                  className="sr-network-input"
                />
              </Field>

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
                  minLength={6}
                  placeholder="At least 6 characters"
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

              {infoMsg && (
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--sr-info-soft)',
                  border: '1px solid var(--sr-info)',
                  borderRadius: 'var(--sr-radius-md)',
                  fontSize: 13, color: 'var(--sr-info)', lineHeight: 1.5,
                }}>
                  {infoMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !displayName.trim() || !!infoMsg}
                data-testid="button-sign-up"
                className="sr-network-button"
                style={{
                  height: 44,
                  cursor: loading || !displayName.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: loading || !displayName.trim() ? 0.5 : 1,
                }}
              >
                {loading && <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />}
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>

            <p style={{ marginTop: 'var(--sr-space-5)', textAlign: 'center', fontSize: 14, color: 'var(--sr-fg-2)' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--sr-accent)', textDecoration: 'none', fontWeight: 500 }}>
                Sign in
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
