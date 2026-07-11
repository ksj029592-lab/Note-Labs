create table if not exists notes (
  id text primary key,
  user_id text not null,
  title text not null,
  version integer not null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists note_conflict_copies (
  id text primary key,
  original_note_id text not null,
  user_id text not null,
  attempted_title text not null,
  expected_version integer not null,
  actual_version integer not null,
  created_at timestamptz not null,
  constraint fk_conflict_original_note
    foreign key (original_note_id)
    references notes(id)
    on delete cascade
);
