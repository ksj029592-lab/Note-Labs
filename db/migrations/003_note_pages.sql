create table if not exists note_pages (
  id text primary key,
  note_id text not null,
  page_index integer not null,
  content_text text not null default '',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_page_note
    foreign key (note_id)
    references notes(id)
    on delete cascade,
  constraint uq_note_page_index unique (note_id, page_index)
);

create index if not exists idx_note_pages_note_page
  on note_pages (note_id, page_index);
