import { useEffect, useState } from 'react';
import { Globe, Lock, Clock } from 'lucide-react';
import { supabase, type Room } from '@/lib/supabase';

interface RoomCardProps {
  room: Room;
  onClick: () => void;
}

interface MemberInfo {
  count: number;
  names: string[];
}

function formatElapsed(started_at: string) {
  const elapsed = Math.floor((Date.now() - new Date(started_at).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const typeIcons = { open: Globe, invite: Lock };
const typeLabels = { open: 'Open', invite: 'Invite-only' };

export function RoomCard({ room, onClick }: RoomCardProps) {
  const [memberInfo, setMemberInfo] = useState<MemberInfo>({ count: 0, names: [] });
  const [activeSession, setActiveSession] = useState<{ started_at: string } | null>(null);
  const [elapsed, setElapsed] = useState('');
  const [hovered, setHovered] = useState(false);
  const [hostName, setHostName] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const [membersRes, sessionRes, hostRes] = await Promise.all([
        supabase.from('room_members').select('user_id').eq('room_id', room.id),
        supabase.from('sessions').select('started_at').eq('room_id', room.id).is('ended_at', null).maybeSingle(),
        supabase.from('profiles').select('display_name').eq('id', room.created_by).single(),
      ]);

      const userIds = membersRes.data?.map((m: any) => m.user_id) || [];

      let names: string[] = [];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('display_name')
          .in('id', userIds);
        names = profiles?.map((p: any) => p.display_name).filter(Boolean) || [];
      }

      setMemberInfo({ count: userIds.length, names });
      if (sessionRes.data) setActiveSession(sessionRes.data);
      if (hostRes.data) setHostName(hostRes.data.display_name);
    };
    fetchData();
  }, [room.id, room.created_by]);

  useEffect(() => {
    if (!activeSession) return;
    const tick = () => setElapsed(formatElapsed(activeSession.started_at));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const TypeIcon = typeIcons[room.type];
  const displayNames = memberInfo.names.slice(0, 4);
  const extra = memberInfo.count - 4;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-testid={`card-room-${room.id}`}
      className="sr-glass sr-nodes"
      style={{
        padding: 'var(--sr-space-5)',
        borderRadius: 'var(--sr-radius-xl)',
        background: hovered ? 'rgba(129, 140, 248, 0.08)' : 'var(--sr-glass-surface)',
        borderColor: hovered ? 'var(--sr-accent)' : 'var(--sr-glass-border)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 0 15px var(--sr-accent-soft)' : 'var(--sr-glass-shadow)',
        cursor: 'pointer',
        transition: `all var(--sr-duration-fast) var(--sr-ease-out)`,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: memberInfo.count > 0
              ? (activeSession ? 'var(--sr-success)' : 'var(--sr-warning)')
              : 'var(--sr-fg-3)',
          }} />
          <span style={{ fontSize: 'var(--sr-text-lg)', fontWeight: 600, color: 'var(--sr-fg-1)', lineHeight: 1.3 }}>
            {room.name}
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--sr-fg-2)' }}>
          Hosted by {hostName || '…'}
        </div>
      </div>

      <div style={{ fontSize: 14, color: 'var(--sr-fg-1)' }}>
        <span style={{ fontWeight: 600 }}>{memberInfo.count}</span>
        <span style={{ color: 'var(--sr-fg-2)' }}> {memberInfo.count === 1 ? 'person' : 'people'} joined</span>
      </div>

      {memberInfo.count > 0 && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {displayNames.map((name, i) => (
            <div
              key={i}
              title={name}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'var(--sr-accent-soft)',
                border: '2px solid var(--sr-surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, color: 'var(--sr-accent)',
                marginLeft: i > 0 ? -8 : 0,
                flexShrink: 0,
              }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          ))}
          {extra > 0 && (
            <div style={{ fontSize: 12, color: 'var(--sr-fg-2)', marginLeft: 6 }}>+{extra} more</div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 'var(--sr-radius-sm)',
          background: 'var(--sr-surface-raised)',
          fontSize: 12, color: 'var(--sr-fg-3)',
        }}>
          <TypeIcon size={10} />
          {typeLabels[room.type]}
        </div>
        {activeSession && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--sr-fg-2)', fontFamily: 'var(--sr-font-mono)' }}>
            <Clock size={10} style={{ color: 'var(--sr-success)' }} />
            {elapsed}
          </div>
        )}
      </div>
    </div>
  );
}
