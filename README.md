# Study Rooms

A real-time collaborative study room app: virtual rooms where people study together with shared Pomodoro timers, live presence, and chat.

## Stack

- **React 18 + TypeScript** — UI
- **Vite** — build tool
- **wouter** — lightweight router
- **Supabase** — auth, Postgres, realtime (presence, chat, sessions)
- **lucide-react** — icons

## Features

- **Auth** — email/password signup and login via Supabase Auth.
- **Two room types**:
  - **Open** — anyone can see the room in the lobby and join with one click.
  - **Invite-only** — only people with the invite link can join.
- **Invite links** — every invite-only room gets a shareable URL (`/join/:code`). Sharing it is the only way in. If the recipient isn't logged in, they're redirected to log in and then auto-joined.
- **Live presence** — see who's in the room and what status they have (studying / on break / idle).
- **Shared Pomodoro timer** — admin starts a session; everyone's timer is in sync.
- **Live chat** — Supabase realtime channels for in-room messages.
- **Admin controls** — kick members, delete the room, transfer host before leaving.
- **Dashboard** — your personal study stats.

## Setup

```bash
# 1. Install
npm install

# 2. Create .env from the example
cp .env.example .env
# Fill in your Supabase URL and anon key

# 3. Apply the database schema
# Open Supabase → SQL Editor → paste contents of supabase-schema.sql → Run

# 4. Run the dev server
npm run dev
```

The app will be at `http://localhost:5173`.

## Project Structure

```
src/
├── App.tsx               Routes (wouter)
├── main.tsx              React entry point
├── index.css             Global styles + tokens import
├── lib/
│   └── supabase.ts       Supabase client + shared types
├── context/
│   ├── AuthContext.tsx   User + profile state
│   ├── ThemeContext.tsx  Dark/light toggle
│   └── ToastContext.tsx  Toast notifications
├── components/
│   ├── RouteGuard.tsx    Protects authenticated routes
│   ├── TopNav.tsx        Top navigation bar
│   ├── CreateRoomModal.tsx
│   ├── RoomCard.tsx
│   ├── PresenceSidebar.tsx
│   ├── Timer.tsx         Pomodoro timer (realtime synced)
│   └── Chat.tsx          Realtime chat
├── pages/
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── Lobby.tsx         Room list + create
│   ├── Room.tsx          The in-room experience
│   ├── Join.tsx          /join/:code — invite link handler
│   └── Dashboard.tsx     Personal stats
└── styles/
    └── tokens.css        Design tokens (colors, spacing, etc.)
```

## How invite links work

1. User creates an invite-only room. A 6-char `invite_code` is generated and stored on the room.
2. The room owner copies the invite link from the top of the room: `https://yoursite.com/join/ABC123`.
3. Recipient clicks the link.
   - **Not logged in?** The code is saved to `sessionStorage`, they're sent to `/login`. After login, they're auto-forwarded to `/join/ABC123`.
   - **Logged in?** A `room_members` row is inserted, then they land in `/rooms/:id`.
4. Already a member? They just go straight into the room — no duplicate insert.

## Key talking points for the interview

- **Why wouter over react-router?** ~2KB vs ~50KB; the API is nearly identical (`useLocation`, `<Route>`, `<Link>`) and we don't need nested routes.
- **Realtime architecture**: Supabase Realtime channels per room. Presence is its own channel keyed by `user.id`. Chat and Pomodoro use `postgres_changes` subscriptions. Kick is a `DELETE` listener on `room_members` filtered by `room_id`.
- **RLS for security**: the `is_room_member()` SECURITY DEFINER function avoids RLS recursion when checking membership for message/session policies.
- **Optimistic UX**: invite-only rooms still appear in the lobby (no leaking secrets — `invite_code` is the secret, not the room's existence). Clicking shows "Ask the host for an invite link."
- **Why session-storage for pending invite?** It survives the login redirect but doesn't persist if the user closes the tab — exactly the lifecycle we want.
