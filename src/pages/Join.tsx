import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

/**
 * /join/:code — invite link handler.
 *
 * Flow:
 *   1. If auth still loading → wait.
 *   2. If user is NOT logged in → save pending invite code to sessionStorage, go to /login.
 *   3. If logged in → look up room by invite_code, add membership if missing, redirect to /rooms/:id.
 */

const PENDING_INVITE_KEY = 'sr_pending_invite';

export default function Join() {
  const { code } = useParams<{ code: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!code) {
      setError('No invite code provided.');
      return;
    }

    const inviteCode = code.toUpperCase();

    // Not logged in — stash the code, send to login
    if (!user) {
      sessionStorage.setItem(PENDING_INVITE_KEY, inviteCode);
      setLocation('/login');
      return;
    }

    // Prevent double-run
    if (joining) return;
    setJoining(true);

    let cancelled = false;

    const doJoin = async () => {
      try {
         // 1. Look up the room by invite code
        const { data: room, error: roomErr } = await supabase
          .from('rooms')
          .select('id, created_by, name')
          .eq('invite_code', inviteCode)
          .maybeSingle();

      if (cancelled) return;

      if (roomErr || !room) {
          setError("That invite link doesn't match any room. It may have been deleted or revoked.");
          return;
        }
        
        // 2. Add membership if not already a member
        const { data: existing } = await supabase
          .from('room_members')
          .select('id')
          .eq('room_id', room.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (!existing) {
          const role = room.created_by === user.id ? 'admin' : 'member';
          const { error: joinErr } = await supabase.from('room_members').insert({
            room_id: room.id,
            user_id: user.id,
            role,
          });
          if (cancelled) return;
          if (joinErr && !joinErr.message.toLowerCase().includes('duplicate')) {
            setError(joinErr.message);
            return;
          }
          toast({ variant: 'success', title: `Joined "${room.name}"` });
        }

        // 3. Redirect to the room
        if (!cancelled) {
          setLocation(`/rooms/${room.id}`);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Something went wrong. Please try again.');
        }
      }
    };

    doJoin();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  return (
    <div style={{
      minHeight: '100vh', background: 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--sr-space-5)',
    }}>
      <div className="sr-glass sr-nodes" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 16, textAlign: 'center', maxWidth: 360, padding: 'var(--sr-space-6)'
      }}>
        {error ? (
          <>
            <AlertCircle size={40} style={{ color: 'var(--sr-danger)' }} />
            <h2 style={{ fontSize: 'var(--sr-text-lg)', fontWeight: 600, color: 'var(--sr-fg-1)' }}>
              Invite not valid
            </h2>
            <p style={{ fontSize: 14, color: 'var(--sr-fg-2)', lineHeight: 1.6 }}>{error}</p>
            <button
              onClick={() => setLocation('/')}
              className="sr-network-button"
              style={{
                height: 36, padding: '0 20px',
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Go to lobby
            </button>
          </>
        ) : (
          <>
            <Loader2 size={32} style={{ color: 'var(--sr-accent)', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: 14, color: 'var(--sr-fg-2)' }}>Joining room…</p>
          </>
        )}
      </div>
    </div>
  );
}

export { PENDING_INVITE_KEY };
