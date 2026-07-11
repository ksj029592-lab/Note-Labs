alter table note_conflict_copies
  add column if not exists attempted_pages_count integer null;

alter table note_conflict_copies
  add column if not exists attempted_strokes_count integer null;
