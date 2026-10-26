export const SCHEMA_SQL = String.raw`-- GapFinder AI relational schema.
-- Applied on first database connection by src/lib/db/index.ts.
-- All identifiers are application-generated UUIDv4 strings; timestamps are ISO-8601 UTC text.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  exam_date TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subjects_owner ON subjects(owner_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  minutes_per_day INTEGER NOT NULL DEFAULT 60,
  session_minutes INTEGER NOT NULL DEFAULT 45,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  last_subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'notes',
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  file_data BLOB,
  status TEXT NOT NULL CHECK (status IN ('processing','ready','failed')),
  error_message TEXT,
  page_count INTEGER,
  char_count INTEGER,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_owner_subject ON documents(owner_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_documents_sha ON documents(owner_id, sha256);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  page_number INTEGER,
  section_heading TEXT,
  char_start INTEGER,
  char_end INTEGER,
  embedding BLOB,
  embedding_model TEXT NOT NULL,
  embedding_dim INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_chunks_owner_subject ON document_chunks(owner_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_model ON document_chunks(owner_id, embedding_model, embedding_dim);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  importance INTEGER NOT NULL DEFAULT 50,
  position INTEGER NOT NULL DEFAULT 0,
  source_document_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
  source_page INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE (subject_id, parent_id, name)
);
CREATE INDEX IF NOT EXISTS idx_topics_owner_subject ON topics(owner_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_parent ON topics(parent_id);

CREATE TABLE IF NOT EXISTS topic_dependencies (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  prerequisite_topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'explicit',
  created_at TEXT NOT NULL,
  UNIQUE (topic_id, prerequisite_topic_id)
);

CREATE TABLE IF NOT EXISTS topic_sources (
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  PRIMARY KEY (topic_id, chunk_id)
);
CREATE INDEX IF NOT EXISTS idx_topic_sources_topic ON topic_sources(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_sources_chunk ON topic_sources(chunk_id);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq','short_answer')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  prompt TEXT NOT NULL,
  options_json TEXT,
  correct_index INTEGER,
  expected_answer TEXT NOT NULL,
  rubric_json TEXT NOT NULL,
  marks REAL NOT NULL,
  generator TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (subject_id, prompt_hash)
);
CREATE INDEX IF NOT EXISTS idx_questions_owner_subject ON questions(owner_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id);

CREATE TABLE IF NOT EXISTS question_sources (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER,
  section_heading TEXT,
  rank INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (question_id, chunk_id)
);
CREATE INDEX IF NOT EXISTS idx_sources_chunk ON question_sources(chunk_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in_progress','submitted')),
  question_ids_json TEXT NOT NULL,
  total_marks REAL NOT NULL,
  score REAL,
  started_at TEXT NOT NULL,
  submitted_at TEXT,
  generator TEXT NOT NULL,
  draft_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_attempts_owner_subject ON quiz_attempts(owner_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_attempts_started ON quiz_attempts(owner_id, started_at DESC);

CREATE TABLE IF NOT EXISTS answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_text TEXT,
  selected_index INTEGER,
  score REAL NOT NULL,
  max_marks REAL NOT NULL,
  correctness TEXT NOT NULL CHECK (correctness IN ('correct','partial','incorrect')),
  feedback TEXT NOT NULL,
  matched_concepts_json TEXT NOT NULL DEFAULT '[]',
  missing_concepts_json TEXT NOT NULL DEFAULT '[]',
  evaluation_method TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_answers_attempt ON answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_answers_owner ON answers(owner_id);

CREATE TABLE IF NOT EXISTS mastery_snapshots (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  attempt_id TEXT REFERENCES quiz_attempts(id) ON DELETE SET NULL,
  mastery REAL,
  classification TEXT NOT NULL CHECK (classification IN ('not_assessed','weak','developing','strong')),
  evidence_answers INTEGER NOT NULL,
  evidence_marks REAL NOT NULL,
  method_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_topic ON mastery_snapshots(topic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_owner_subject ON mastery_snapshots(owner_id, subject_id, created_at);

CREATE TABLE IF NOT EXISTS revision_plans (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  exam_date TEXT NOT NULL,
  minutes_per_day INTEGER NOT NULL,
  session_minutes INTEGER NOT NULL,
  horizon_days INTEGER NOT NULL,
  capacity_minutes INTEGER NOT NULL,
  allocated_minutes INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','superseded')),
  rationale_json TEXT NOT NULL,
  change_summary_json TEXT NOT NULL DEFAULT '[]',
  trigger TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (subject_id, version)
);
CREATE INDEX IF NOT EXISTS idx_plans_owner_subject ON revision_plans(owner_id, subject_id, version DESC);

CREATE TABLE IF NOT EXISTS revision_tasks (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES revision_plans(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  priority REAL NOT NULL,
  priority_reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','completed')),
  carried_from_task_id TEXT,
  completed_at TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_plan ON revision_tasks(plan_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON revision_tasks(owner_id, status);

-- Operational telemetry with no document text: provider, model, outcome and a short reason.
CREATE TABLE IF NOT EXISTS ai_events (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_events_owner ON ai_events(owner_id, created_at DESC);
`;

