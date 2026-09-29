-- Proposed MVP schema for the Programming Learning Platform.
-- Reference DDL tested with SQLite. Implement equivalent Drizzle definitions and
-- committed migrations. Application services enforce the additional invariants
-- in specification section 11. Epoch timestamps are UTC milliseconds.
PRAGMA foreign_keys = ON;

CREATE TABLE app_user (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  email_canonical TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  ui_locale TEXT NOT NULL DEFAULT 'en',
  theme TEXT NOT NULL DEFAULT 'system' CHECK(theme IN ('light','dark','system')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE session (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  CHECK(expires_at > created_at)
);
CREATE INDEX session_user_expiry ON session(user_id, expires_at);
CREATE TABLE auth_throttle (
  key_hash TEXT PRIMARY KEY NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK(failure_count >= 0),
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER
);
CREATE TABLE course (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE course_release (
  id TEXT PRIMARY KEY NOT NULL,
  course_id TEXT NOT NULL REFERENCES course(id) ON DELETE RESTRICT,
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','published','retired')),
  source_filename TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL,
  content_language TEXT NOT NULL DEFAULT 'sr-Latn',
  source_verified_date TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(course_id,version), UNIQUE(id,course_id)
);

-- ContentItem is the shared identity for navigation, provenance, notes and search.
-- Typed detail tables below contain model-specific fields.
CREATE TABLE content_item (
  id TEXT PRIMARY KEY NOT NULL,
  release_id TEXT NOT NULL REFERENCES course_release(id) ON DELETE RESTRICT,
  stable_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('module','week','day','lesson','exercise','task','guide','preparation')),
  parent_id TEXT,
  order_index INTEGER NOT NULL CHECK(order_index >= 0),
  title TEXT NOT NULL,
  body_markdown TEXT NOT NULL DEFAULT '',
  required INTEGER NOT NULL DEFAULT 1 CHECK(required IN (0,1)),
  content_hash TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata_json)),
  UNIQUE(release_id,stable_key), UNIQUE(id,release_id),
  FOREIGN KEY(parent_id,release_id) REFERENCES content_item(id,release_id) ON DELETE RESTRICT
);
CREATE INDEX content_parent_order ON content_item(release_id,parent_id,order_index);
CREATE TABLE course_module (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES content_item(id) ON DELETE RESTRICT,
  phase_number INTEGER NOT NULL CHECK(phase_number BETWEEN 1 AND 6),
  introduction_markdown TEXT NOT NULL DEFAULT ''
);
CREATE TABLE course_week (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES content_item(id) ON DELETE RESTRICT,
  week_number INTEGER NOT NULL CHECK(week_number BETWEEN 1 AND 26),
  objective_markdown TEXT NOT NULL,
  primary_resources_text TEXT NOT NULL,
  main_evidence_markdown TEXT NOT NULL,
  source_date_range TEXT NOT NULL,
  phase_signal_markdown TEXT
);
CREATE TABLE course_day (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES content_item(id) ON DELETE RESTRICT,
  day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 182),
  source_date TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL CHECK(estimated_minutes > 0),
  ai_policy_markdown TEXT NOT NULL,
  completion_criterion_markdown TEXT NOT NULL,
  assessment_kind TEXT NOT NULL CHECK(assessment_kind IN ('practice','weekly_checkpoint','final_exam')),
  remediation_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(remediation_json))
);
CREATE TABLE lesson (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES content_item(id) ON DELETE RESTRICT,
  objective_markdown TEXT,
  study_instruction_markdown TEXT NOT NULL,
  blocks_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(blocks_json))
);
CREATE TABLE exercise (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES content_item(id) ON DELETE RESTRICT,
  related_lesson_id TEXT NOT NULL REFERENCES lesson(item_id) ON DELETE RESTRICT,
  instructions_markdown TEXT NOT NULL,
  expected_result_markdown TEXT NOT NULL,
  difficulty TEXT CHECK(difficulty IN ('introductory','developing','advanced')),
  estimated_minutes INTEGER CHECK(estimated_minutes > 0),
  hints_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(hints_json)),
  solution_markdown TEXT,
  help_policy TEXT NOT NULL DEFAULT 'source_rules',
  evidence_required INTEGER NOT NULL DEFAULT 1 CHECK(evidence_required IN (0,1))
);
CREATE TABLE exercise_task (
  item_id TEXT PRIMARY KEY NOT NULL REFERENCES content_item(id) ON DELETE RESTRICT,
  requirement_mode TEXT NOT NULL CHECK(requirement_mode IN ('required','optional','conditional','alternative','mixed')),
  rule_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(rule_json))
);
CREATE TABLE resource (
  id TEXT PRIMARY KEY NOT NULL,
  release_id TEXT NOT NULL REFERENCES course_release(id) ON DELETE RESTRICT,
  stable_key TEXT NOT NULL,
  title TEXT NOT NULL,
  original_url TEXT,
  resolved_url TEXT,
  source_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('documentation','article','video','course','tool','reference','practice','guide')),
  description_markdown TEXT NOT NULL DEFAULT '',
  link_origin TEXT NOT NULL CHECK(link_origin IN ('source','verified_enrichment','unresolved')),
  link_status TEXT NOT NULL DEFAULT 'unchecked' CHECK(link_status IN ('unchecked','ok','redirect','unavailable')),
  checked_at INTEGER,
  UNIQUE(release_id,stable_key), UNIQUE(id,release_id)
);
CREATE TABLE resource_use (
  id TEXT PRIMARY KEY NOT NULL,
  release_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  content_item_id TEXT NOT NULL,
  assigned_text TEXT NOT NULL,
  section_locator TEXT,
  requirement_mode TEXT NOT NULL CHECK(requirement_mode IN ('required','optional','reference','conditional')),
  order_index INTEGER NOT NULL,
  FOREIGN KEY(resource_id,release_id) REFERENCES resource(id,release_id) ON DELETE RESTRICT,
  FOREIGN KEY(content_item_id,release_id) REFERENCES content_item(id,release_id) ON DELETE RESTRICT
);
CREATE INDEX resource_use_item ON resource_use(content_item_id,order_index);
CREATE TABLE source_block (
  id TEXT PRIMARY KEY NOT NULL,
  release_id TEXT NOT NULL REFERENCES course_release(id) ON DELETE RESTRICT,
  source_locator TEXT NOT NULL,
  source_style TEXT NOT NULL,
  table_number INTEGER,
  row_number INTEGER,
  cell_number INTEGER,
  exact_text TEXT NOT NULL,
  links_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(links_json)),
  text_sha256 TEXT NOT NULL,
  UNIQUE(release_id,source_locator), UNIQUE(id,release_id)
);
CREATE TABLE source_mapping (
  id TEXT PRIMARY KEY NOT NULL,
  release_id TEXT NOT NULL,
  source_block_id TEXT NOT NULL,
  content_item_id TEXT NOT NULL,
  target_field TEXT NOT NULL,
  website_location TEXT NOT NULL,
  mapping_kind TEXT NOT NULL CHECK(mapping_kind IN ('verbatim','structured','reference','metadata')),
  FOREIGN KEY(source_block_id,release_id) REFERENCES source_block(id,release_id) ON DELETE RESTRICT,
  FOREIGN KEY(content_item_id,release_id) REFERENCES content_item(id,release_id) ON DELETE RESTRICT
);
CREATE TABLE enrollment (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  preparation_acknowledged_at INTEGER,
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  last_opened_item_id TEXT,
  last_opened_at INTEGER,
  resume_item_id TEXT,
  resume_anchor TEXT,
  resume_updated_at INTEGER,
  UNIQUE(user_id,course_id), UNIQUE(id,release_id),
  FOREIGN KEY(release_id,course_id) REFERENCES course_release(id,course_id) ON DELETE RESTRICT,
  FOREIGN KEY(last_opened_item_id,release_id) REFERENCES content_item(id,release_id) ON DELETE RESTRICT,
  FOREIGN KEY(resume_item_id,release_id) REFERENCES content_item(id,release_id) ON DELETE RESTRICT
);
CREATE TABLE user_progress (
  enrollment_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('started','completed')),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(enrollment_id,lesson_id),
  FOREIGN KEY(enrollment_id,release_id) REFERENCES enrollment(id,release_id) ON DELETE CASCADE,
  FOREIGN KEY(lesson_id,release_id) REFERENCES content_item(id,release_id) ON DELETE RESTRICT,
  FOREIGN KEY(lesson_id) REFERENCES lesson(item_id) ON DELETE RESTRICT,
  CHECK((status='completed' AND completed_at IS NOT NULL) OR (status='started' AND completed_at IS NULL))
);
CREATE TABLE exercise_progress (
  enrollment_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('started','completed')),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  criterion_attested_at INTEGER,
  result TEXT CHECK(result IN ('passed','needs_review')),
  evidence_text TEXT NOT NULL DEFAULT '',
  selected_scope TEXT NOT NULL DEFAULT '',
  rubric_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(rubric_json)),
  revealed_hint_level INTEGER NOT NULL DEFAULT 0 CHECK(revealed_hint_level BETWEEN 0 AND 5),
  solution_revealed_at INTEGER,
  rewrite_attested_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(enrollment_id,exercise_id),
  FOREIGN KEY(enrollment_id,release_id) REFERENCES enrollment(id,release_id) ON DELETE CASCADE,
  FOREIGN KEY(exercise_id,release_id) REFERENCES content_item(id,release_id) ON DELETE RESTRICT,
  FOREIGN KEY(exercise_id) REFERENCES exercise(item_id) ON DELETE RESTRICT,
  CHECK((status='completed' AND completed_at IS NOT NULL AND criterion_attested_at IS NOT NULL AND result IS NOT NULL AND result='passed' AND length(trim(evidence_text))>0) OR (status='started' AND completed_at IS NULL))
);
CREATE TABLE task_progress (
  enrollment_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('done','not_applicable')),
  reason TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(enrollment_id,task_id),
  FOREIGN KEY(enrollment_id,release_id) REFERENCES enrollment(id,release_id) ON DELETE CASCADE,
  FOREIGN KEY(task_id,release_id) REFERENCES content_item(id,release_id) ON DELETE RESTRICT,
  FOREIGN KEY(task_id) REFERENCES exercise_task(item_id) ON DELETE RESTRICT,
  CHECK(status!='not_applicable' OR length(trim(reason))>0)
);
CREATE TABLE preparation_progress (
  enrollment_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  preparation_item_id TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  PRIMARY KEY(enrollment_id,preparation_item_id),
  FOREIGN KEY(enrollment_id,release_id) REFERENCES enrollment(id,release_id) ON DELETE CASCADE,
  FOREIGN KEY(preparation_item_id,release_id) REFERENCES content_item(id,release_id) ON DELETE RESTRICT
);
CREATE TABLE note (
  id TEXT PRIMARY KEY NOT NULL,
  enrollment_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  content_item_id TEXT NOT NULL,
  body_text TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(enrollment_id,content_item_id),
  FOREIGN KEY(enrollment_id,release_id) REFERENCES enrollment(id,release_id) ON DELETE CASCADE,
  FOREIGN KEY(content_item_id,release_id) REFERENCES content_item(id,release_id) ON DELETE RESTRICT
);
CREATE TABLE scorecard (
  id TEXT PRIMARY KEY NOT NULL,
  enrollment_id TEXT NOT NULL REFERENCES enrollment(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  ratings_json TEXT NOT NULL CHECK(json_valid(ratings_json)),
  evidence_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(evidence_json)),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(enrollment_id,period_key)
);
CREATE TABLE activity_event (
  id TEXT PRIMARY KEY NOT NULL,
  enrollment_id TEXT NOT NULL REFERENCES enrollment(id) ON DELETE CASCADE,
  item_stable_key TEXT,
  type TEXT NOT NULL CHECK(type IN ('lesson_completed','lesson_reopened','exercise_completed','exercise_reopened','checkpoint_needs_review','day_completed','day_reopened','course_completed','course_reopened','release_migrated')),
  occurred_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(payload_json))
);
CREATE INDEX activity_recent ON activity_event(enrollment_id,occurred_at DESC);
CREATE TABLE mutation_receipt (
  enrollment_id TEXT NOT NULL REFERENCES enrollment(id) ON DELETE CASCADE,
  mutation_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK(json_valid(response_json)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(enrollment_id,mutation_id)
);
-- Rollups are computed from canonical progress, never incremented counters.
CREATE VIEW completed_day AS
SELECT e.id AS enrollment_id, d.item_id AS day_id,
       max(p.completed_at, x.completed_at) AS completed_at
FROM enrollment e
JOIN content_item di ON di.release_id=e.release_id AND di.kind='day'
JOIN course_day d ON d.item_id=di.id
JOIN content_item li ON li.parent_id=di.id AND li.kind='lesson'
JOIN user_progress p ON p.enrollment_id=e.id AND p.lesson_id=li.id AND p.status='completed'
JOIN content_item xi ON xi.parent_id=li.id AND xi.kind='exercise'
JOIN exercise_progress x ON x.enrollment_id=e.id AND x.exercise_id=xi.id AND x.status='completed';
-- Initial-release invariant: one required lesson per day and one required
-- exercise bundle beneath that lesson. A later multi-lesson release must replace
-- this view with an ALL-required-descendants aggregation before publication.
