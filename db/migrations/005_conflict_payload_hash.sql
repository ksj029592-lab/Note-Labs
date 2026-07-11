alter table note_conflict_copies
  add column if not exists attempted_payload_hash text null;
