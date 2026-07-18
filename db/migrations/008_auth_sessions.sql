create table if not exists user_sessions (
  token text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null
);

create index if not exists idx_user_sessions_user_id on user_sessions (user_id);
create index if not exists idx_user_sessions_expires_at on user_sessions (expires_at);
