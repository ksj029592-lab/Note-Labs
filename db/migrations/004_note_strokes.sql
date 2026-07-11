create table if not exists note_strokes (
  id text primary key,
  note_id text not null,
  page_index integer null,
  tool_type text not null,
  color text not null,
  width double precision not null,
  points_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_stroke_note
    foreign key (note_id)
    references notes(id)
    on delete cascade
);

create index if not exists idx_note_strokes_note_created
  on note_strokes (note_id, created_at asc);
