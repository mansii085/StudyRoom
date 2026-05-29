import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { Copy, Check, Loader2, Trash2, UserCheck, Link as LinkIcon } from 'lucide-react';
import { supabase, type RoomType } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { RouteGuard } from '@/components/RouteGuard';
import { TopNav } from '@/components/TopNav';
import { PresenceSidebar, PresenceMember, PresenceStatus } from '@/components/PresenceSidebar';
import { Timer } from '@/components/Timer';
import { Chat } from '@/components/Chat';

interface RoomData {
  id: string;
  name: string;
  type: RoomType;
  created_by: string;
  invite_code: string | null;
}

type PresencePayload = {
  user_id: string;
  display_name: string;
  status: PresenceStatus;
};

const SESSION_ROOM_KEY = 'sr_active_room';

export default function Room() {
  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myStatus, setMyStatus] = useState<'studying' | 'break' | 'idle'>('studying');
  const [hostName, setHostName] = useState('');
  const [copied, setCopied] = useState(false);

  // Modals
  const [kickConfirm, setKickConfirm] = useState<{ userId: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [adminLeaveModal, setAdminLeaveModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ userId: string; name: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Track active room in sessionStorage ─────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    sessionStorage.setItem(SESSION_ROOM_KEY, JSON.stringify({ id: roomId, name: '' }));
  }, [roomId]);

  useEffect(() => {
    if (room) {
      sessionStorage.setItem(SESSION_ROOM_KEY, JSON.stringify({ id: room.id, name: room.name }));
    }
  }, [room]);

  // ─── Load room + verify membership ───────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!roomId || !user) return;
      try {
        const [roomRes, memberRes] = await Promise.all([
          supabase.from('rooms').select('*').eq('id', roomId).single(),
          supabase.from('room_members').select('role').eq('room_id', roomId).eq('user_id', user.id).maybeSingle(),
        ]);

      if (roomRes.error || !roomRes.data) {
          toast({ variant: 'error', title: 'Room not found' });
          sessionStorage.removeItem(SESSION_ROOM_KEY);
          setLocation('/');
          return;
        }

      // Auto-join open rooms for non-members who arrive via a shared link
        if (!memberRes.data) {
          if (roomRes.data.type === 'open') {
            const role = roomRes.data.created_by === user.id ? 'admin' : 'member';
            const { error: joinErr } = await supabase.from('room_members').insert({
              room_id: roomId,
              user_id: user.id,
              role,
            });
            if (joinErr && !joinErr.message.toLowerCase().includes('duplicate')) {
              toast({ variant: 'error', title: 'Could not join room', body: joinErr.message });
              sessionStorage.removeItem(SESSION_ROOM_KEY);
              setLocation('/');
              return;
            }
            toast({ variant: 'success', title: `Joined "${roomRes.data.name}"` });
          } else {
            toast({ variant: 'error', title: 'Invite-only room', body: 'Ask the host for an invite link to join.' });

              sessionStorage.removeItem(SESSION_ROOM_KEY);
              setLocation('/');
              return;
            }
      }
      setRoom(roomRes.data);
        const memberRole = memberRes.data?.role;
        const adminByRole = memberRole === 'admin';
        const adminByOwnership = roomRes.data.created_by === user.id;
        setIsAdmin(adminByRole || adminByOwnership);

      // Re-promote creator if their role somehow drifted
        if (adminByOwnership && !adminByRole) {
          supabase.from('room_members')
            .update({ role: 'admin' })
            .eq('room_id', roomId)
            .eq('user_id', user.id)
            .then(() => {});
        }

        setLoading(false);

      const { data: hostProfile } = await supabase
          .from('profiles').select('display_name').eq('id', roomRes.data.created_by).single();
        if (hostProfile) setHostName(hostProfile.display_name);
      } catch (err: any) {
        toast({ variant: 'error', title: 'Failed to load room', body: err?.message || 'Unknown error' });
        setLoading(false);
      }
    };
    load();
  }, [roomId, user, toast, setLocation]);

  // ─── Presence ─────────────────────────────────────────────────────────────────
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId || !user || !profile || loading || !room) return;

    const channel = supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: user.id } },
    });
    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>();
        setMembers(Object.entries(state).map(([uid, presences]) => {
          const p = (presences as any[])[0];
          return {
            user_id: uid,
            display_name: p?.display_name || 'Unknown',
            role: uid === room.created_by ? 'admin' : 'member',
            status: p?.status || 'idle',
          };
        }));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const p = (newPresences as any[])[0];
        setMembers(prev => {
          if (prev.find(m => m.user_id === key)) {
            return prev.map(m => m.user_id === key ? { ...m, status: p?.status || m.status } : m);
          }
          return [...prev, {
            user_id: key,
            display_name: p?.display_name || 'Unknown',
            role: key === room.created_by ? 'admin' : 'member',
            status: p?.status || 'studying',
          }];
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setMembers(prev => prev.filter(m => m.user_id !== key));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            display_name: profile.display_name,
            status: myStatus,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [roomId, user, profile, loading, room]);

  useEffect(() => {
    const ch = presenceChannelRef.current;
    if (!ch || !user || !profile) return;
    ch.track({ user_id: user.id, display_name: profile.display_name, status: myStatus }).catch(() => {});
  }, [myStatus, user, profile]);

  // ─── Kick detection ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !user) return;
    const channel = supabase
      .channel(`kick:${roomId}:${user.id}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, (payload) => {
        if ((payload.old as any)?.user_id === user.id) {
          sessionStorage.removeItem(SESSION_ROOM_KEY);
          toast({ variant: 'warning', title: 'You were removed from this room' });
          setLocation('/');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, user, toast, setLocation]);

  // ─── Room deleted by admin ────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-deleted:${roomId}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, () => {
        sessionStorage.removeItem(SESSION_ROOM_KEY);
        toast({ variant: 'warning', title: 'This room has been closed' });
        setLocation('/');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, toast, setLocation]);

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const performLeave = useCallback(async () => {
    if (!user || !roomId) return;
    sessionStorage.removeItem(SESSION_ROOM_KEY);
    await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', user.id);
    setLocation('/');
  }, [user, roomId, setLocation]);

  const handleLeave = useCallback(async () => {
    if (!isAdmin) {
      await performLeave();
      return;
    }
    const { data: otherMembers } = await supabase
      .from('room_members')
      .select('user_id, profiles(display_name)')
      .eq('room_id', roomId)
      .neq('user_id', user!.id)
      .limit(10);

    if (!otherMembers || otherMembers.length === 0) {
      await performLeave();
      return;
    }

    const candidate = otherMembers[0];
    const candidateName = (candidate as any).profiles?.display_name || 'Another member';
    setTransferTarget({ userId: candidate.user_id, name: candidateName });
    setAdminLeaveModal(true);
  }, [isAdmin, roomId, user, performLeave]);

  const handleTransferAndLeave = async () => {
    if (!transferTarget || !roomId || !user) return;
    setActionLoading(true);
    setAdminLeaveModal(false);
    await supabase.from('room_members')
      .update({ role: 'admin' })
      .eq('room_id', roomId)
      .eq('user_id', transferTarget.userId);
    await supabase.from('room_members')
      .update({ role: 'member' })
      .eq('room_id', roomId)
      .eq('user_id', user.id);
    toast({ variant: 'success', title: `Host transferred to ${transferTarget.name}` });
    setActionLoading(false);
    await performLeave();
  };

  const handleDeleteRoom = async () => {
    if (!room) return;
    setActionLoading(true);
    setDeleteConfirm(false);
    setAdminLeaveModal(false);
    const { error } = await supabase.from('rooms').delete().eq('id', room.id);
    if (error) {
      toast({ variant: 'error', title: 'Could not delete room', body: error.message });
      setActionLoading(false);
      return;
    }
    sessionStorage.removeItem(SESSION_ROOM_KEY);
    setLocation('/');
  };

  const handleKick = useCallback((userId: string, name: string) => {
    setKickConfirm({ userId, name });
  }, []);

  const confirmKick = async () => {
    if (!kickConfirm || !roomId) return;
    const { userId, name } = kickConfirm;
    setKickConfirm(null);
    await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
    toast({ variant: 'success', title: `${name} was removed from the room` });
  };

// Copy invite link — always uses /join/ route so it works for non-members and non-logged-in users  const copyLink = () => {
  const copyLink = () => {
    if (!room) return;
    const text = `${window.location.origin}/join/${room.invite_code}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({
      variant: 'success',
      title: 'Invite link copied',
      body: 'Share it with anyone you want to study with.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} style={{ color: 'var(--sr-accent)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <RouteGuard>
      <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column' }}>
        <TopNav roomName={room?.name} hostedBy={hostName} onLeave={handleLeave} />

        {/* Sub-bar */}
        <div style={{
          position: 'fixed', top: 'var(--sr-nav-height)', left: 0, right: 0, height: 40,
          background: 'var(--sr-glass-surface)', 
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--sr-glass-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 var(--sr-space-5)', gap: 8,
          zIndex: 'var(--sr-z-sticky)' as any,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {room && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LinkIcon size={12} style={{ color: 'var(--sr-fg-3)' }} />
                <span className="sr-eyebrow" style={{ fontSize: 11, color: 'var(--sr-fg-2)' }}>
                  Invite link
                </span>
                <code style={{
                  fontFamily: 'var(--sr-font-mono)', fontSize: 13,
                  color: 'var(--sr-fg-1)',
                  background: 'var(--sr-surface-sunken)',
                  padding: '2px 8px', borderRadius: 'var(--sr-radius-sm)',
                  maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {`${window.location.origin}/join/${room.invite_code}`}
                </code>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={copyLink}
              data-testid="button-copy-link"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 26, padding: '0 10px',
                background: 'transparent', border: '1px solid var(--sr-border)',
                borderRadius: 'var(--sr-radius-md)',
                color: 'var(--sr-fg-2)', fontSize: 12, cursor: 'pointer',
              }}
            >
              {copied ? <Check size={11} style={{ color: 'var(--sr-success)' }} /> : <Copy size={11} />}
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>

            {isAdmin && (
              <button
                onClick={() => setDeleteConfirm(true)}
                disabled={actionLoading}
                data-testid="button-delete-room"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  height: 26, padding: '0 10px',
                  background: 'transparent', border: '1px solid var(--sr-border)',
                  borderRadius: 'var(--sr-radius-md)',
                  color: 'var(--sr-danger)', fontSize: 12, cursor: 'pointer',
                }}
              >
                <Trash2 size={11} />
                Delete room
              </button>
            )}
          </div>
        </div>

        {/* 3-column layout - Modern Floating Panels */}
        <div style={{
          display: 'flex',
          height: '100vh',
          padding: `calc(var(--sr-nav-height) + 56px) var(--sr-space-5) var(--sr-space-5)`,
          gap: 'var(--sr-space-5)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          <PresenceSidebar members={members} currentUserId={user?.id || ''} isAdmin={isAdmin} onKick={handleKick} />
          <Timer roomId={roomId} isAdmin={isAdmin} currentUserId={user?.id || ''} myStatus={myStatus} onStatusChange={setMyStatus} />
          <Chat roomId={roomId} />
        </div>

        {kickConfirm && (
          <Modal onClose={() => setKickConfirm(null)}>
            <h3 style={mTitle}>Remove {kickConfirm.name}?</h3>
            <p style={mBody}>They'll be removed from the room. They can rejoin if the room is open.</p>
            <MFooter>
              <GhostBtn onClick={() => setKickConfirm(null)}>Cancel</GhostBtn>
              <DangerBtn onClick={confirmKick} testId="button-confirm-kick">Remove</DangerBtn>
            </MFooter>
          </Modal>
        )}

        {deleteConfirm && (
          <Modal onClose={() => setDeleteConfirm(false)}>
            <h3 style={mTitle}>Delete "{room?.name}"?</h3>
            <p style={mBody}>This permanently removes the room, all messages, and session history for everyone. This cannot be undone.</p>
            <MFooter>
              <GhostBtn onClick={() => setDeleteConfirm(false)}>Cancel</GhostBtn>
              <DangerBtn onClick={handleDeleteRoom} testId="button-confirm-delete-room">
                {actionLoading && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
                Delete room
              </DangerBtn>
            </MFooter>
          </Modal>
        )}

        {adminLeaveModal && (
          <Modal onClose={() => setAdminLeaveModal(false)}>
            <h3 style={mTitle}>You're the host</h3>
            <p style={mBody}>What would you like to do before leaving?</p>
            {transferTarget && (
              <div style={{
                margin: '16px 0', padding: '12px 14px',
                background: 'var(--sr-surface-raised)',
                border: '1px solid var(--sr-border)',
                borderRadius: 'var(--sr-radius-md)',
                fontSize: 13, color: 'var(--sr-fg-2)',
              }}>
                Host will be transferred to <strong style={{ color: 'var(--sr-fg-1)' }}>{transferTarget.name}</strong>.
              </div>
            )}
            <MFooter>
              <GhostBtn onClick={() => setAdminLeaveModal(false)}>Cancel</GhostBtn>
              <DangerBtn onClick={handleDeleteRoom} testId="button-admin-leave-delete">
                <Trash2 size={13} />
                Close room
              </DangerBtn>
              {transferTarget && (
                <AccentBtn onClick={handleTransferAndLeave} testId="button-transfer-host">
                  <UserCheck size={13} />
                  Transfer &amp; leave
                </AccentBtn>
              )}
            </MFooter>
          </Modal>
        )}
      </div>
    </RouteGuard>
  );
}

// ─── Modal primitives ─────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--sr-scrim)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 'var(--sr-z-overlay)' as any }} />
      <div className="sr-glass" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        borderRadius: 'var(--sr-radius-2xl)', padding: 'var(--sr-space-6)',
        zIndex: 'var(--sr-z-modal)' as any, width: 'min(420px, 92vw)',
      }}>
        {children}
      </div>
    </>
  );
}
function MFooter({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'var(--sr-space-5)', flexWrap: 'wrap' }}>{children}</div>;
}
function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ height: 36, padding: '0 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--sr-fg-2)', fontSize: 14 }}>
      {children}
    </button>
  );
}
function DangerBtn({ children, onClick, testId }: { children: React.ReactNode; onClick: () => void; testId?: string }) {
  return (
    <button onClick={onClick} data-testid={testId} style={{ height: 36, padding: '0 16px', background: 'var(--sr-danger)', color: '#fff', border: 'none', borderRadius: 'var(--sr-radius-md)', cursor: 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  );
}
function AccentBtn({ children, onClick, testId }: { children: React.ReactNode; onClick: () => void; testId?: string }) {
  return (
    <button onClick={onClick} data-testid={testId} style={{ height: 36, padding: '0 16px', background: 'var(--sr-accent)', color: 'var(--sr-fg-invert)', border: 'none', borderRadius: 'var(--sr-radius-md)', cursor: 'pointer', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  );
}
const mTitle: React.CSSProperties = { fontSize: 'var(--sr-text-lg)', fontWeight: 600, color: 'var(--sr-fg-1)', marginBottom: 8 };
const mBody: React.CSSProperties = { fontSize: 14, color: 'var(--sr-fg-2)', lineHeight: 1.65 };
