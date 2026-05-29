-- ─────────────────────────────────────────────
-- Study Rooms — Supabase Schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query)
-- ─────────────────────────────────────────────

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- 2. Tables
-- ─────────────────────────────────────────────

-- 2.1 Profiles (mirrors auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Rooms — two types: open (anyone joins from lobby) or invite (only via /join/:code link)
CREATE TABLE IF NOT EXISTS rooms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('open', 'invite')),
  invite_code   TEXT UNIQUE,
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 Room members
CREATE TABLE IF NOT EXISTS room_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- 2.4 Messages
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 Sessions (Pomodoro timer)
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  started_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

-- ─────────────────────────────────────────────
-- 3. Indexes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_room_members_room    ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user    ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room        ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at  ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_room        ON sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_sessions_ended_at    ON sessions(ended_at);
CREATE INDEX IF NOT EXISTS idx_rooms_invite_code    ON rooms(invite_code);

-- ─────────────────────────────────────────────
-- 4. Row-Level Security
-- ─────────────────────────────────────────────
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;

-- Helper: check if calling user is a member of a room
-- SECURITY DEFINER avoids RLS recursion
CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_members
    WHERE room_id = p_room_id
      AND user_id = auth.uid()
  );
$$;

-- 4.1 Profiles
CREATE POLICY "Users can read all profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (id = auth.uid());

-- 4.2 Rooms
CREATE POLICY "Anyone can view rooms"
  ON rooms FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create rooms"
  ON rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Room creator can update room"
  ON rooms FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Room creator can delete room"
  ON rooms FOR DELETE USING (created_by = auth.uid());

-- 4.3 Room members
CREATE POLICY "Members can view room members"
  ON room_members FOR SELECT USING (true);

CREATE POLICY "Authenticated users can join rooms"
  ON room_members FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Room admin can delete members (kick)"
  ON room_members FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_members.room_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'admin'
    )
  );

CREATE POLICY "Admin can update member roles (transfer host)"
  ON room_members FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = room_members.room_id
        AND rm.user_id = auth.uid()
        AND rm.role = 'admin'
    )
  );

-- 4.4 Messages
CREATE POLICY "Room members can read messages"
  ON messages FOR SELECT USING (is_room_member(room_id));

CREATE POLICY "Room members can send messages"
  ON messages FOR INSERT WITH CHECK (
    user_id = auth.uid() AND is_room_member(room_id)
  );

-- 4.5 Sessions
CREATE POLICY "Room members can view sessions"
  ON sessions FOR SELECT USING (is_room_member(room_id));

CREATE POLICY "Room admin can start sessions"
  ON sessions FOR INSERT WITH CHECK (
    started_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = sessions.room_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Room admin can end sessions"
  ON sessions FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_id = sessions.room_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- ─────────────────────────────────────────────
-- 5. Realtime Publications
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- ─────────────────────────────────────────────
-- 6. Auto-create profile on signup trigger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ─────────────────────────────────────────────
-- 7. FK from room_members → profiles (for implicit joins)
-- ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'room_members_user_id_fkey_profiles'
      AND table_name = 'room_members'
  ) THEN
    ALTER TABLE room_members
      ADD CONSTRAINT room_members_user_id_fkey_profiles
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7b. FK from messages → profiles (enables PostgREST embedded selects)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_user_id_fkey_profiles'
      AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_user_id_fkey_profiles
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
