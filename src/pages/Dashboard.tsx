import { useEffect, useState } from 'react';
import { ArrowLeft, Cpu, Activity, Zap, Network, History } from 'lucide-react';
import { Link } from 'wouter';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { RouteGuard } from '@/components/RouteGuard';
import { TopNav } from '@/components/TopNav';

interface SessionRecord {
  id: string;
  room_id: string;
  started_at: string;
  ended_at: string | null;
  room_name: string;
}

interface Stats {
  totalSessions: number;
  totalMinutes: number;
  totalMessages: number;
  roomsJoined: number;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return '< 1m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Cpu; label: string; value: string; accent?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="sr-glass sr-nodes"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 'var(--sr-radius-xl)',
        padding: 'var(--sr-space-5)',
        display: 'flex', flexDirection: 'column', gap: 10,
        fontFamily: 'var(--sr-font-sans)',
        background: 'var(--sr-glass-surface)',
        borderColor: hovered ? 'var(--sr-accent)' : 'var(--sr-glass-border)',
        boxShadow: hovered ? '0 0 15px var(--sr-accent-soft)' : 'var(--sr-glass-shadow)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'all var(--sr-duration-fast) var(--sr-ease-out)',
        cursor: 'default',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={15} style={{ color: hovered || accent ? 'var(--sr-accent)' : 'var(--sr-fg-3)', transition: 'color var(--sr-duration-fast)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--sr-tracking-caps)', color: 'var(--sr-fg-2)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 'var(--sr-text-2xl)', fontWeight: 700, color: 'var(--sr-fg-1)', fontFamily: 'var(--sr-font-mono)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalSessions: 0, totalMinutes: 0, totalMessages: 0, roomsJoined: 0 });
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Check if user has an active room session
  const [activeRoom, setActiveRoom] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('sr_active_room');
    if (stored) {
      try { setActiveRoom(JSON.parse(stored)); } catch {}
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      const [membersRes, sessionsRes, messagesRes] = await Promise.all([
        supabase.from('room_members').select('room_id').eq('user_id', user.id),
        supabase.from('sessions').select('*, rooms(name)').eq('started_by', user.id).order('started_at', { ascending: false }).limit(1000),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      const roomIds = membersRes.data?.map(m => m.room_id) || [];

      let totalMinutes = 0;
      const sessionRecords: SessionRecord[] = [];
      if (sessionsRes.data) {
        for (const s of sessionsRes.data) {
          const ended = s.ended_at ? new Date(s.ended_at) : new Date();
          const started = new Date(s.started_at);
          const mins = Math.floor((ended.getTime() - started.getTime()) / 60000);
          totalMinutes += mins;
          sessionRecords.push({
            id: s.id,
            room_id: s.room_id,
            started_at: s.started_at,
            ended_at: s.ended_at,
            room_name: (s.rooms as any)?.name || 'Unknown room',
          });
        }
      }

      setStats({
        totalSessions: sessionsRes.data?.length || 0,
        totalMinutes,
        totalMessages: messagesRes.count || 0,
        roomsJoined: roomIds.length,
      });
      // Only show the 25 most recent sessions in the list
      setSessions(sessionRecords.slice(0, 25));
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <RouteGuard>
      <div style={{ minHeight: '100vh', background: 'transparent', fontFamily: 'var(--sr-font-sans)' }}>
        <TopNav />
        <div style={{
          paddingTop: 'var(--sr-nav-height)',
          maxWidth: 960,
          margin: '0 auto',
          padding: `var(--sr-nav-height) var(--sr-space-6) var(--sr-space-7)`,
        }}>
          <div style={{ paddingTop: 'var(--sr-space-7)' }}>

            {/* Back button integrated into header */}

            {/* Page header */}
            <div style={{ marginBottom: 'var(--sr-space-6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sr-space-4)', marginBottom: 4 }}>
                <h1 className="sr-text-gradient" style={{ fontSize: 'var(--sr-text-3xl)', fontWeight: 800, letterSpacing: 'var(--sr-tracking-tight)', display: 'inline-block' }}>
                  Activity
                </h1>
                {activeRoom && (
                  <Link href={`/rooms/${activeRoom.id}`} title="Back to room">
                    <button className="sr-network-button" style={{ 
                      width: 40, height: 40, borderRadius: '50%', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      cursor: 'pointer' 
                    }}>
                      <ArrowLeft size={18} />
                    </button>
                  </Link>
                )}
              </div>
              <p style={{ fontSize: 16, color: 'var(--sr-fg-2)' }}>Your study history and lifetime stats.</p>
            </div>

            {/* Stats grid */}
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 'var(--sr-space-6)' }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="sr-glass sr-nodes" style={{ borderRadius: 'var(--sr-radius-xl)', padding: 'var(--sr-space-5)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="sr-skeleton" style={{ width: '55%', height: 11 }} />
                    <div className="sr-skeleton" style={{ width: '40%', height: 28 }} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sr-space-4)',
              marginBottom: 'var(--sr-space-8)'
            }}>
              <StatCard icon={Activity} label="Time spent" value={formatDuration(stats.totalMinutes * 60)} accent />
              <StatCard icon={Cpu} label="Total sessions" value={stats.totalSessions.toString()} />
              <StatCard icon={Zap} label="Messages sent" value={stats.totalMessages.toString()} />
              <StatCard icon={Network} label="Rooms joined" value={stats.roomsJoined.toString()} />
            </div>
            )}

            {/* Session history */}
            <div>
              <h2 style={{ fontSize: 'var(--sr-text-xl)', fontWeight: 600, color: 'var(--sr-fg-1)', marginBottom: 'var(--sr-space-4)' }}>
                Session history
              </h2>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="sr-glass sr-nodes" style={{ borderRadius: 'var(--sr-radius-xl)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div className="sr-skeleton" style={{ width: 120, height: 13 }} />
                        <div className="sr-skeleton" style={{ width: 80, height: 11 }} />
                      </div>
                      <div className="sr-skeleton" style={{ width: 48, height: 13 }} />
                    </div>
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div className="sr-glass sr-nodes" style={{
                  textAlign: 'center', padding: 'var(--sr-space-8)',
                  color: 'var(--sr-fg-3)', fontSize: 15,
                  borderRadius: 'var(--sr-radius-xl)',
                }}>
                  No sessions yet. Start a Pomodoro timer in any room to track focus time.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sessions.map(s => {
                    const ended = s.ended_at ? new Date(s.ended_at) : new Date();
                    const duration = Math.floor((ended.getTime() - new Date(s.started_at).getTime()) / 60000);
                    return (
                      <div
                        key={s.id}
                        data-testid={`session-row-${s.id}`}
                        className="sr-glass sr-nodes"
                        style={{
                          borderRadius: 'var(--sr-radius-xl)', padding: '16px 24px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                          transition: 'transform var(--sr-duration-fast)',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--sr-fg-1)', marginBottom: 2 }}>
                            {s.room_name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--sr-fg-3)' }}>{formatDate(s.started_at)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontFamily: 'var(--sr-font-mono)', color: 'var(--sr-fg-1)' }}>
                            {formatDuration(duration * 60)}
                          </div>
                          {!s.ended_at && (
                            <div style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: 'var(--sr-success-soft)', color: 'var(--sr-success)' }}>
                              Live
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </RouteGuard>
  );
}
