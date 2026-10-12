-- Additive account settings state; independent of course enrollment/progress.
ALTER TABLE app_user ADD COLUMN settings_revision INTEGER NOT NULL DEFAULT 0
  CHECK (settings_revision >= 0);

CREATE TABLE settings_receipt (
  user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  mutation_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, mutation_id)
);
CREATE INDEX settings_receipt_user_id_created_at_index
  ON settings_receipt (user_id, created_at);
