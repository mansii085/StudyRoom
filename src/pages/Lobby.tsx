import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Plus, Users, ArrowRight } from 'lucide-react';
import { supabase, type Room } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { RouteGuard } from '@/components/RouteGuard';
import { TopNav } from '@/components/TopNav';
import { RoomCard } from '@/components/RoomCard';
import { CreateRoomModal } from '@/components/CreateRoomModal';

export default function Lobby() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isNewRoomOpen, setIsNewRoomOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRooms(data);
    setLoading(false);
  };

  useEffect(() => { fetchRooms(); }, []);

  // Join (open room) or navigate to room if already a member
  const joinRoom = async (room: Room) => {
    if (!user) return;
    const role = room.created_by === user.id ? 'admin' : 'member';
    const { error } = await supabase.from('room_members').insert({
      room_id: room.id,
      user_id: user.id,
      role,
    });
    if (error && !error.message.toLowerCase().includes('duplicate')) {
      toast({ variant: 'error', title: 'Could not join room', body: error.message });
      return;
    }
    setLocation(`/rooms/${room.id}`);
  };

  const handleRoomClick = async (room: Room) => {
    if (!user) return;

    // Already a member — go straight in
    const { data: membership } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', room.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membership) {
      // Re-promote creator to admin if they came back as member
      if (room.created_by === user.id) {
        await supabase.from('room_members')
          .update({ role: 'admin' })
          .eq('room_id', room.id)
          .eq('user_id', user.id);
      }
      setLocation(`/rooms/${room.id}`);
      return;
    }

    if (room.type === 'invite') {
      toast({
        variant: 'error',
        title: 'Invite-only room',
        body: 'Ask the host for an invite link to join.',
      });
      return;
    }

    // Open room — join immediately
    await joinRoom(room);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.trim()) {
      setLocation(`/join/${inviteCode.trim()}`);
    }
  };

  return (
    <RouteGuard>
      <div style={{ minHeight: '100vh', background: 'transparent' }}>
        <TopNav />
        <div style={{
          maxWidth: 'var(--sr-content-max)',
          margin: '0 auto',
          padding: `var(--sr-nav-height) var(--sr-space-6) var(--sr-space-7)`,
        }}>
          {/* Page header */}
          <div 
            className="sr-glass" 
            style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--sr-space-5)',
            marginBottom: 'var(--sr-space-6)', padding: 'var(--sr-space-5)',
            borderRadius: 'var(--sr-radius-xl)', marginTop: 'var(--sr-space-4)'
          }}>
            <div>
              <h1 style={{
                fontSize: 'var(--sr-text-3xl)', fontWeight: 700,
                color: 'var(--sr-fg-1)', letterSpacing: 'var(--sr-tracking-tight)',
                marginBottom: 4,
              }}>
                Study rooms
              </h1>
              <p style={{ fontSize: 16, color: 'var(--sr-fg-2)' }}>Join an open room or create your own.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <form onSubmit={handleJoinByCode} style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="sr-network-input"
                  style={{
                    height: 44, width: 140, padding: '0 12px',
                    color: 'var(--sr-fg-1)', fontSize: 14,
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={!inviteCode.trim()}
                  className="sr-network-button"
                  style={{
                    height: 44, width: 44, borderRadius: '0 10px 10px 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: inviteCode.trim() ? 'pointer' : 'not-allowed',
                    marginLeft: -1,
                  }}
                >
                  <ArrowRight size={18} />
                </button>
              </form>
              <button
                onClick={() => setShowCreateModal(true)}
                data-testid="button-create-room"
                className="sr-button-active sr-network-button"
                style={{
                  height: 44, padding: '0 24px',
                  background: 'var(--sr-accent)', color: '#fff',
                  border: 'none', borderRadius: 'var(--sr-radius-md)',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <Plus size={18} />
                New room
              </button>
            </div>
          </div>

          {/* Room grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--sr-space-5)' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="sr-glass" style={{
                  borderRadius: 'var(--sr-radius-xl)',
                  padding: 'var(--sr-space-5)',
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}>
                  <div className="sr-skeleton" style={{ width: '60%', height: 18 }} />
                  <div className="sr-skeleton" style={{ width: '40%', height: 14 }} />
                  <div className="sr-skeleton" style={{ width: '50%', height: 14 }} />
                </div>
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              paddingTop: 'var(--sr-space-9)', gap: 16, textAlign: 'center',
            }}>
              <Users size={56} style={{ color: 'var(--sr-fg-3)', strokeWidth: 1.5 }} />
              <h2 style={{ fontSize: 'var(--sr-text-xl)', fontWeight: 600, color: 'var(--sr-fg-1)' }}>
                No rooms yet
              </h2>
              <p style={{ fontSize: 14, color: 'var(--sr-fg-2)', maxWidth: 280, lineHeight: 1.6 }}>
                Create one to start studying together.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  height: 36, padding: '0 20px',
                  background: 'var(--sr-accent)', color: 'var(--sr-fg-invert)',
                  border: 'none', borderRadius: 'var(--sr-radius-md)',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Create a room
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--sr-space-5)' }}>
              {rooms.map(room => (
                <RoomCard key={room.id} room={room} onClick={() => handleRoomClick(room)} />
              ))}
            </div>
          )}
        </div>

        {showCreateModal && (
          <CreateRoomModal
            onClose={() => setShowCreateModal(false)}
            onCreated={(id) => {
              setShowCreateModal(false);
              fetchRooms();
              setLocation(`/rooms/${id}`);
            }}
          />
        )}
      </div>
    </RouteGuard>
  );
}
