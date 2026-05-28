import { Crown, MoreHorizontal, UserX } from 'lucide-react';
import { useState } from 'react';

export type PresenceStatus = 'studying' | 'break' | 'idle' | 'offline';

export interface PresenceMember {
  user_id: string;
  display_name: string;
  role: 'admin' | 'member';
  status: PresenceStatus;
  joined_at?: string;
}

interface PresenceSidebarProps {
  members: PresenceMember[];
  currentUserId: string;
  isAdmin: boolean;
  onKick: (userId: string, name: string) => void;
}

function PresenceDot({ status, withGlow = false }: { status: PresenceStatus; withGlow?: boolean }) {
  const colorMap: Record<PresenceStatus, string> = {
    studying: 'var(--sr-presence-studying)',
    break: 'var(--sr-presence-break)',
    idle: 'var(--sr-presence-idle)',
    offline: 'var(--sr-presence-offline)',
  };
  const isOffline = status === 'offline';
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      background: isOffline ? 'transparent' : colorMap[status],
      border: isOffline ? `1.5px solid var(--sr-presence-offline)` : 'none',
      boxShadow: withGlow && status === 'studying'
        ? `0 0 0 2px var(--sr-success-soft)`
        : 'none',
    }} />
  );
}

function getAvatarGradient(name: string) {
  const gradients = [
    'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return gradients[sum % gradients.length];
}

const statusOrder: Record<PresenceStatus, number> = {
  studying: 1,
  break: 2,
  idle: 3,
  offline: 4,
};

export function PresenceSidebar({ members, currentUserId, isAdmin, onKick }: PresenceSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [popoverId, setPopoverId] = useState<string | null>(null);

  const sorted = [...members].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (b.role === 'admin' && a.role !== 'admin') return 1;
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div className="sr-glass sr-nodes" style={{
      width: 'var(--sr-sidebar-width)',
      borderRadius: 'var(--sr-radius-xl)',
      height: '100%',
      overflowY: 'auto',
      flexShrink: 0,
      fontFamily: 'var(--sr-font-sans)',
      paddingBottom: '16px',
    }}>
      <div style={{ padding: '20px 16px 12px' }}>
        <div className="sr-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Participants
          <span style={{ color: 'var(--sr-fg-1)', fontFamily: 'var(--sr-font-sans)', letterSpacing: 0, textTransform: 'none', fontWeight: 500 }}>
            {members.length}
          </span>
        </div>
      </div>

      <div style={{ paddingBottom: 16 }}>
        {sorted.map(member => {
          const isMe = member.user_id === currentUserId;
          const canKick = isAdmin && !isMe && member.role !== 'admin';

          return (
            <div
              key={member.user_id}
              onMouseEnter={() => setHoveredId(member.user_id)}
              onMouseLeave={() => { setHoveredId(null); if (popoverId === member.user_id) setPopoverId(null); }}
              data-testid={`presence-member-${member.user_id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                height: 56, padding: '0 16px',
                background: hoveredId === member.user_id ? 'var(--sr-surface-raised)' : 'transparent',
                transition: `background var(--sr-duration-fast)`,
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: getAvatarGradient(member.display_name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 600, fontSize: 13,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  {member.display_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--sr-surface)', borderRadius: '50%', padding: 2 }}>
                  <PresenceDot status={member.status} withGlow />
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--sr-fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.display_name}
                    {isMe && <span style={{ color: 'var(--sr-fg-3)', fontWeight: 400 }}> (you)</span>}
                  </span>
                  {member.role === 'admin' && (
                    <Crown size={12} style={{ color: 'var(--sr-warning)', flexShrink: 0 }} />
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--sr-fg-2)', marginTop: 1 }}>
                  {member.status === 'studying' ? 'Studying' : member.status === 'break' ? 'On break' : 'Idle'}
                </div>
              </div>

              {member.role === 'admin' && (
                <div style={{
                  fontSize: 11, fontWeight: 500,
                  padding: '2px 6px', borderRadius: 4,
                  background: 'var(--sr-warning-soft)',
                  color: 'var(--sr-warning)',
                  flexShrink: 0,
                }}>
                  host
                </div>
              )}

              {canKick && hoveredId === member.user_id && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setPopoverId(popoverId === member.user_id ? null : member.user_id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sr-fg-3)', padding: 4 }}
                    data-testid={`button-member-menu-${member.user_id}`}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {popoverId === member.user_id && (
                    <div style={{
                      position: 'absolute', right: 0, top: 32,
                      background: 'var(--sr-surface-raised)',
                      border: '1px solid var(--sr-border)',
                      borderRadius: 'var(--sr-radius-lg)',
                      boxShadow: 'var(--sr-shadow-md)',
                      padding: 4, minWidth: 160,
                      zIndex: 'var(--sr-z-overlay)' as any,
                    }}>
                      <button
                        onClick={() => { setPopoverId(null); onKick(member.user_id, member.display_name); }}
                        data-testid={`button-kick-${member.user_id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', padding: '8px 12px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderRadius: 'var(--sr-radius-md)',
                          color: 'var(--sr-danger)', fontSize: 13, fontWeight: 500,
                          fontFamily: 'var(--sr-font-sans)',
                        }}
                      >
                        <UserX size={14} />
                        Kick from room
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
