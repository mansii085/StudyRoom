import { useState } from 'react';
import { X, Globe, Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface CreateRoomModalProps {
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

type RoomType = 'open' | 'invite';

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function CreateRoomModal({ onClose, onCreated }: CreateRoomModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<RoomType>('open');
  const [loading, setLoading] = useState(false);

  const canCreate = name.trim().length > 0;

  const handleCreate = async () => {
    if (!user || !canCreate) return;
    setLoading(true);
    try {
      const inviteCode = generateInviteCode();
      const { data: room, error } = await supabase
        .from('rooms')
        .insert({
          name: name.trim(),
          type,
          invite_code: inviteCode,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('room_members').insert({
        room_id: room.id,
        user_id: user.id,
        role: 'admin',
      });

      toast({ variant: 'success', title: 'Room created', body: name.trim() });
      onCreated(room.id);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed to create room', body: err.message });
    } finally {
      setLoading(false);
    }
  };

  const types: { value: RoomType; label: string; icon: typeof Globe; helper: string }[] = [
    { value: 'open', label: 'Open', icon: Globe, helper: 'Anyone with the link can join.' },
    { value: 'invite', label: 'Invite-only', icon: Lock, helper: 'Only people with your invite link.' },
  ];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'var(--sr-scrim)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 'var(--sr-z-overlay)' as any,
        }}
      />
      <div className="sr-glass" style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: 'var(--sr-radius-2xl)',
        padding: 'var(--sr-space-6)',
        width: '90%', maxWidth: 480,
        zIndex: 'var(--sr-z-modal)' as any,
        fontFamily: 'var(--sr-font-sans)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sr-space-5)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--sr-text-lg)', fontWeight: 600, color: 'var(--sr-fg-1)', marginBottom: 4 }}>
              New study room
            </h2>
            <p style={{ fontSize: 13, color: 'var(--sr-fg-2)' }}>Create a space to study with others.</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sr-fg-3)', padding: 4 }}
            data-testid="button-close-modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Room name */}
        <div style={{ marginBottom: 'var(--sr-space-5)' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 'var(--sr-tracking-caps)', color: 'var(--sr-fg-2)', marginBottom: 8 }}>
            Room name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Finals week — Discrete Math"
            autoFocus
            data-testid="input-room-name"
            style={{
              width: '100%', height: 36, padding: '0 12px',
              background: 'var(--sr-surface-sunken)',
              border: '1px solid var(--sr-border)',
              borderRadius: 'var(--sr-radius-md)',
              color: 'var(--sr-fg-1)', fontSize: 14,
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Who can join */}
        <div style={{ marginBottom: 'var(--sr-space-5)' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 'var(--sr-tracking-caps)', color: 'var(--sr-fg-2)', marginBottom: 8 }}>
            Who can join
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {types.map(({ value, label, icon: Icon, helper }) => {
              const selected = type === value;
              return (
                <button
                  key={value}
                  onClick={() => setType(value)}
                  data-testid={`radio-room-type-${value}`}
                  style={{
                    padding: 12, borderRadius: 'var(--sr-radius-lg)', cursor: 'pointer',
                    border: selected ? '1.5px solid var(--sr-accent)' : '1px solid var(--sr-border)',
                    background: selected ? 'var(--sr-accent-soft)' : 'var(--sr-surface-sunken)',
                    textAlign: 'left',
                    transition: `border-color var(--sr-duration-fast), background var(--sr-duration-fast)`,
                    position: 'relative',
                  }}
                >
                  <Icon size={16} style={{ color: selected ? 'var(--sr-accent)' : 'var(--sr-fg-3)', marginBottom: 6 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: selected ? 'var(--sr-accent)' : 'var(--sr-fg-1)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--sr-fg-2)', lineHeight: 1.5 }}>{helper}</div>
                  {selected && (
                    <div style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--sr-accent)',
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {type === 'invite' && (
          <div style={{ marginBottom: 'var(--sr-space-5)', padding: 12, background: 'var(--sr-surface-sunken)', borderRadius: 'var(--sr-radius-md)', fontSize: 13, color: 'var(--sr-fg-2)' }}>
            You'll get a shareable invite link. Anyone with the link can join — they just need to be logged in.
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'var(--sr-space-2)' }}>
          <button
            onClick={onClose}
            style={{
              height: 36, padding: '0 16px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--sr-fg-2)', fontSize: 14, fontWeight: 500,
              borderRadius: 'var(--sr-radius-md)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || loading}
            data-testid="button-create-room"
            style={{
              height: 36, padding: '0 20px',
              background: 'var(--sr-accent)',
              color: 'var(--sr-fg-invert)', border: 'none',
              cursor: !canCreate || loading ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 500, borderRadius: 'var(--sr-radius-md)',
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: !canCreate || loading ? 0.5 : 1,
            }}
          >
            {loading && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
            Create
          </button>
        </div>
      </div>
    </>
  );
}
