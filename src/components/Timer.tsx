import { useEffect, useState } from 'react';
import { Play, Square, Coffee, BookOpen, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';

interface ActiveSession {
  id: string;
  started_at: string;
  ended_at: string | null;
}

interface TimerProps {
  roomId: string;
  isAdmin: boolean;
  currentUserId: string;
  onStatusChange?: (status: 'studying' | 'break' | 'idle') => void;
  myStatus: 'studying' | 'break' | 'idle';
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RING_SIZE = 300;
const RING_RADIUS = 130;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const POMODORO_DURATION = 25 * 60;

export function Timer({ roomId, isAdmin, currentUserId, onStatusChange, myStatus }: TimerProps) {
  const { toast } = useToast();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Load current session
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('room_id', roomId)
        .is('ended_at', null)
        .maybeSingle();
      setSession(data || null);
      setLoading(false);
    };
    load();
  }, [roomId]);

  // Subscribe to session changes
  useEffect(() => {
    const channel = supabase
      .channel(`session:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const s = payload.new as ActiveSession;
            if (!s.ended_at) {
              setSession(s);
              toast({ variant: 'info', title: 'Session started', body: '25-minute Pomodoro.' });
            }
          } else if (payload.eventType === 'UPDATE') {
            const s = payload.new as ActiveSession;
            if (s.ended_at) {
              setSession(null);
              setElapsed(0);
              toast({ variant: 'info', title: 'Session ended' });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, toast]);

  // Tick
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const e = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000);
      setElapsed(e);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const startSession = async () => {
    setStarting(true);
    const { error } = await supabase.from('sessions').insert({
      room_id: roomId,
      started_by: currentUserId,
    });
    if (error) {
      toast({ variant: 'error', title: 'Could not start session', body: error.message });
    }
    setStarting(false);
  };

  const endSession = async () => {
    if (!session) return;
    setEnding(true);
    setShowEndConfirm(false);
    await supabase.from('sessions').update({ ended_at: new Date().toISOString() }).eq('id', session.id);
    setEnding(false);
  };

  const ringProgress = session ? Math.min(elapsed / POMODORO_DURATION, 1) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - ringProgress);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 'var(--sr-space-5)',
      fontFamily: 'var(--sr-font-sans)',
      padding: 'var(--sr-space-6)',
    }}>
      {/* Eyebrow */}
      <div className="sr-eyebrow" style={{ textAlign: 'center' }}>
        {session ? 'Session in progress' : 'No session running'}
      </div>

      {/* Ring */}
      <div style={{ position: 'relative', width: RING_SIZE, height: RING_SIZE }}>
        {/* Ambient Glow */}
        {session && (
          <div style={{
            position: 'absolute', inset: -40,
            background: myStatus === 'break' 
              ? 'radial-gradient(circle, rgba(248,113,113,0.4) 0%, rgba(248,113,113,0) 60%)'
              : 'radial-gradient(circle, rgba(168,85,247,0.4) 0%, rgba(168,85,247,0) 60%)',
            filter: 'blur(30px)',
            zIndex: 0,
            animation: 'pulse-glow 4s ease-in-out infinite alternate',
            borderRadius: '50%',
          }} />
        )}
        <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
          <defs>
            <linearGradient id="timerGradientStudying" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--sr-accent)" />
              <stop offset="100%" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="timerGradientBreak" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--sr-warning)" />
              <stop offset="100%" stopColor="#f87171" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Background ring */}
          <circle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--sr-glass-border)"
            strokeWidth={4}
          />
          {/* Progress ring */}
          {session && (
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={myStatus === 'break' ? "url(#timerGradientBreak)" : "url(#timerGradientStudying)"}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              filter="url(#glow)"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
            />
          )}
        </svg>

        {/* Timer digits */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {loading ? (
            <Loader2 size={32} style={{ color: 'var(--sr-fg-3)', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <>
              <div style={{
                fontFamily: 'var(--sr-font-mono)',
                fontSize: 'var(--sr-text-timer)',
                fontWeight: 600,
                color: session ? 'var(--sr-fg-1)' : 'var(--sr-fg-3)',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {session ? formatTime(elapsed) : '—'}
              </div>
              {session && (
                <div style={{ fontSize: 13, color: 'var(--sr-fg-2)' }}>
                  Pomodoro · 25 min
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!session && !loading && (
        <p style={{ fontSize: 13, color: 'var(--sr-fg-3)', textAlign: 'center', maxWidth: 280 }}>
          {isAdmin
            ? 'Start a Pomodoro session for everyone in the room.'
            : 'Only the host can start a session.'}
        </p>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Own status toggle */}
        {session && (
          <button
            onClick={() => onStatusChange?.(myStatus === 'studying' ? 'break' : 'studying')}
            data-testid="button-toggle-status"
            style={{
              height: 36, padding: '0 16px',
              background: 'transparent',
              border: '1px solid var(--sr-border)',
              borderRadius: 'var(--sr-radius-md)',
              color: 'var(--sr-fg-2)', fontSize: 14, fontWeight: 500,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: `background var(--sr-duration-fast)`,
              fontFamily: 'var(--sr-font-sans)',
            }}
          >
            {myStatus === 'studying'
              ? <><Coffee size={16} /> I'm on break</>
              : <><BookOpen size={16} /> I'm studying</>
            }
          </button>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <>
            {!session ? (
              <button
                onClick={startSession}
                disabled={starting}
                data-testid="button-start-session"
                style={{
                  height: 44, padding: '0 24px',
                  background: 'var(--sr-accent)',
                  color: 'var(--sr-fg-invert)', border: 'none',
                  borderRadius: 'var(--sr-radius-md)',
                  fontSize: 14, fontWeight: 500, cursor: starting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  opacity: starting ? 0.7 : 1,
                  fontFamily: 'var(--sr-font-sans)',
                }}
              >
                {starting
                  ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <Play size={16} fill="currentColor" />
                }
                Start session
              </button>
            ) : (
              <button
                onClick={() => setShowEndConfirm(true)}
                disabled={ending}
                data-testid="button-end-session"
                style={{
                  height: 36, padding: '0 16px',
                  background: 'transparent',
                  border: '1px solid var(--sr-border)',
                  borderRadius: 'var(--sr-radius-md)',
                  color: 'var(--sr-danger)', fontSize: 14, fontWeight: 500,
                  cursor: ending ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'var(--sr-font-sans)',
                }}
              >
                {ending
                  ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                  : <Square size={14} fill="currentColor" />
                }
                End session
              </button>
            )}
          </>
        )}
      </div>

      {/* End session confirm */}
      {showEndConfirm && (
        <>
          <div
            onClick={() => setShowEndConfirm(false)}
            style={{ position: 'fixed', inset: 0, background: 'var(--sr-scrim)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 'var(--sr-z-overlay)' as any }}
          />
          <div className="sr-glass sr-nodes" style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            borderRadius: 'var(--sr-radius-2xl)', padding: 'var(--sr-space-6)',
            zIndex: 'var(--sr-z-modal)' as any, width: 360,
          }}>
            <h3 style={{ fontSize: 'var(--sr-text-lg)', fontWeight: 600, color: 'var(--sr-fg-1)', marginBottom: 8 }}>
              End the session?
            </h3>
            <p style={{ fontSize: 14, color: 'var(--sr-fg-2)', marginBottom: 'var(--sr-space-5)', lineHeight: 1.6 }}>
              The timer will stop for everyone in the room. You can start a new one anytime.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{ height: 36, padding: '0 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--sr-fg-2)', fontSize: 14, fontFamily: 'var(--sr-font-sans)' }}
              >
                Cancel
              </button>
              <button
                onClick={endSession}
                data-testid="button-confirm-end-session"
                style={{
                  height: 36, padding: '0 16px',
                  background: 'var(--sr-danger)', color: '#fff',
                  border: 'none', borderRadius: 'var(--sr-radius-md)',
                  cursor: 'pointer', fontSize: 14, fontWeight: 500, fontFamily: 'var(--sr-font-sans)',
                }}
              >
                End session
              </button>
            </div>
          </div>
        </>
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-glow { 0% { transform: scale(0.9); opacity: 0.7; } 100% { transform: scale(1.05); opacity: 1; } }
      `}</style>
    </div>
  );
}
