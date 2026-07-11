create index if not exists idx_notes_user_updated
  on notes (user_id, updated_at desc);

create index if not exists idx_notes_user_created
  on notes (user_id, created_at asc);

create index if not exists idx_conflicts_original_created
  on note_conflict_copies (original_note_id, created_at asc);
