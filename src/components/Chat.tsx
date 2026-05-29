import { useEffect, useRef, useState, useCallback } from 'react';
import { Send, WifiOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name: string;
}

interface ChatProps {
  roomId: string;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isToday ? time : `Yesterday ${time}`;
}

export function Chat({ roomId }: ChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [realtimeOk, setRealtimeOk] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Profile cache — avoids async inside realtime callback
  const profileCache = useRef<Map<string, string>>(new Map());
  // Latest message timestamp for polling fallback
  const latestAt = useRef<string | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
    }
  }, []);

  const addMessages = useCallback((incoming: Message[]) => {
    setMessages(prev => {
      const existing = new Set(prev.map(m => m.id));
      const fresh = incoming.filter(m => !existing.has(m.id));
      if (!fresh.length) return prev;
      const next = [...prev, ...fresh].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      // Track latest timestamp for polling
      const last = next[next.length - 1];
      if (last) latestAt.current = last.created_at;
      return next;
    });
  }, []);

  // Fetch & cache a profile, returns display name
  const getDisplayName = async (userId: string): Promise<string> => {
    if (profileCache.current.has(userId)) return profileCache.current.get(userId)!;
    const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).single();
    const name = data?.display_name || 'Unknown';
    profileCache.current.set(userId, name);
    return name;
  };

  // ─── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, user_id, content, created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (cancelled || error) {
        if (!cancelled) setLoading(false);
        return;
      }

      const reversed = (data || []).reverse();

      // Batch-fetch all unique user profiles
      const uniqueUserIds = [...new Set(reversed.map((m: any) => m.user_id))];
      const uncachedIds = uniqueUserIds.filter(uid => !profileCache.current.has(uid));
      if (uncachedIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', uncachedIds);
        if (profiles) {
          for (const p of profiles) {
            profileCache.current.set(p.id, p.display_name);
          }
        }
      }

      const msgs: Message[] = reversed.map((m: any) => {
        const name = profileCache.current.get(m.user_id) || 'Unknown';
        return { id: m.id, user_id: m.user_id, content: m.content, created_at: m.created_at, display_name: name };
      });
      if (msgs.length) latestAt.current = msgs[msgs.length - 1].created_at;
      if (!cancelled) {
        setMessages(msgs);
        setLoading(false);
        setTimeout(scrollToBottom, 50);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [roomId, scrollToBottom]);

  // ─── Realtime subscription ────────────────────────────────────────────────────
  useEffect(() => {
    const channelName = `chat-messages:${roomId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const m = payload.new as any;
          // Synchronous lookup from cache to avoid async in callback
          const cachedName = profileCache.current.get(m.user_id);
          const msg: Message = {
            id: m.id,
            user_id: m.user_id,
            content: m.content,
            created_at: m.created_at,
            display_name: cachedName || 'Unknown',
          };
          addMessages([msg]);
          setTimeout(() => scrollToBottom(true), 30);

          // Background refresh if name was unknown
          if (!cachedName) {
            supabase.from('profiles').select('display_name').eq('id', m.user_id).single()
              .then(({ data: p }) => {
                if (p?.display_name) {
                  profileCache.current.set(m.user_id, p.display_name);
                  setMessages(prev => prev.map(x =>
                    x.id === m.id ? { ...x, display_name: p.display_name } : x
                  ));
                }
              });
          }
        }
      )
      .subscribe((status) => {
        setRealtimeOk(status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' ? status === 'SUBSCRIBED' : true);
      });

    return () => { supabase.removeChannel(channel); };
  }, [roomId, addMessages, scrollToBottom]);

  // ─── Polling fallback ─────────────────────────────────────────────────────────
  // Catches any messages that realtime might miss (network blip, filter edge-case)
  useEffect(() => {
    const poll = async () => {
      if (!latestAt.current) return;
      const { data } = await supabase
        .from('messages')
        .select('id, user_id, content, created_at')
        .eq('room_id', roomId)
        .gt('created_at', latestAt.current)
        .order('created_at', { ascending: true })
        .limit(20);

      if (!data?.length) return;

      // Resolve any unknown display names
      const unknownIds = data
        .filter((m: any) => !profileCache.current.has(m.user_id))
        .map((m: any) => m.user_id);
      const uniqueUnknown = [...new Set(unknownIds)];
      if (uniqueUnknown.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', uniqueUnknown);
        if (profiles) {
          for (const p of profiles) {
            profileCache.current.set(p.id, p.display_name);
          }
        }
      }

      const msgs: Message[] = data.map((m: any) => {
        const name = profileCache.current.get(m.user_id) || 'Unknown';
        return { id: m.id, user_id: m.user_id, content: m.content, created_at: m.created_at, display_name: name };
      });
      addMessages(msgs);
      setTimeout(() => scrollToBottom(true), 30);
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [roomId, addMessages, scrollToBottom]);

  // ─── Send ─────────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!user || !content || sending) return;
    setInput('');
    setSending(true);
    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = '36px';

    const { error } = await supabase.from('messages').insert({
      room_id: roomId,
      user_id: user.id,
      content,
    });

    if (error) {
      // Re-insert the content if send failed
      setInput(content);
    }
    setSending(false);
  }, [user, input, sending, roomId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = '36px';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  // ─── Group consecutive messages ────────────────────────────────────────────────
  const grouped = messages.reduce<Array<Message & { showHeader: boolean }>>((acc, msg, i) => {
    const prev = messages[i - 1];
    const showHeader = !prev || prev.user_id !== msg.user_id
      || new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 120_000;
    acc.push({ ...msg, showHeader });
    return acc;
  }, []);

  return (
    <div className="sr-glass sr-nodes" style={{
      width: 'var(--sr-chat-width)',
      borderRadius: 'var(--sr-radius-xl)',
      display: 'flex', flexDirection: 'column',
      height: '100%', flexShrink: 0,
      fontFamily: 'var(--sr-font-sans)',
      minWidth: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--sr-border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--sr-fg-1)' }}>Chat</span>
        {!realtimeOk && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--sr-warning)' }}>
            <WifiOff size={12} />
            Polling
          </div>
        )}
        {/* Empty span removed to clear instructions */}
      </div>

      {/* Message list */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
            {[55, 80, 40, 70].map((w, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: i % 2 === 0 ? 'flex-start' : 'flex-end', gap: 6 }}>
                <div className="sr-skeleton" style={{ width: `${w * 0.5}%`, height: 11 }} />
                <div className="sr-skeleton" style={{ width: `${w}%`, height: 38 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '80%', gap: 8,
            color: 'var(--sr-fg-3)', textAlign: 'center', padding: '0 24px',
          }}>
            <div style={{ fontSize: 28 }}>💬</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>No messages yet</div>
            <div style={{ fontSize: 12 }}>Be the first to say hi.</div>
          </div>
        )}

        {!loading && grouped.map(msg => {
          const isMe = msg.user_id === user?.id;
          return (
            <div
              key={msg.id}
              style={{
                padding: '1px 14px',
                display: 'flex', flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.showHeader && (
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'var(--sr-fg-3)',
                  marginBottom: 3, marginTop: 14,
                  letterSpacing: '0.02em',
                }}>
                  {isMe ? 'You' : msg.display_name}
                  <span style={{ color: 'var(--sr-fg-4)', fontWeight: 400, marginLeft: 6 }}>
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              )}
              <div
                data-testid={`message-bubble-${msg.id}`}
                style={{
                  maxWidth: '82%',
                  padding: '9px 14px',
                  borderRadius: '16px',
                  borderTopLeftRadius: !isMe && msg.showHeader ? 4 : 16,
                  borderTopRightRadius: isMe && msg.showHeader ? 4 : 16,
                  background: isMe 
                    ? 'rgba(168, 85, 247, 0.15)' 
                    : 'rgba(10, 10, 15, 0.4)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: isMe 
                    ? '1px solid rgba(192, 132, 252, 0.6)' 
                    : '1px solid rgba(99, 102, 241, 0.3)',
                  boxShadow: isMe ? '0 0 10px rgba(192, 132, 252, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
                  color: isMe ? '#ffffff' : 'var(--sr-fg-1)',
                  fontSize: 14, lineHeight: 1.55,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div style={{
        borderTop: '1px solid var(--sr-border)',
        padding: '10px 12px',
        display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message… (Enter to send)"
          rows={1}
          data-testid="input-chat-message"
          className="sr-network-input"
          style={{
            flex: 1, resize: 'none', height: 36, minHeight: 36, maxHeight: 120,
            padding: '8px 12px',
            color: 'var(--sr-fg-1)', fontSize: 14,
            outline: 'none', fontFamily: 'var(--sr-font-sans)',
            boxSizing: 'border-box', lineHeight: 1.4,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          data-testid="button-send-message"
          title="Send (Enter)"
          className="sr-network-button"
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            cursor: input.trim() && !sending ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Send size={15} style={{ color: input.trim() && !sending ? 'var(--sr-fg-invert)' : 'var(--sr-fg-4)' }} />
        </button>
      </div>
    </div>
  );
}
