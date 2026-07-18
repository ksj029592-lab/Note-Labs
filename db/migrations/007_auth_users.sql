create table if not exists users (
  id text primary key,
  username text not null,
  username_lower text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_users_username_lower on users (username_lower);
