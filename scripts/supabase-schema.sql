-- ============================================================
--  SOL 監査訪問 — Supabase Database Schema
--  Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================

-- 1. Enterprises (実習実施者)
CREATE TABLE IF NOT EXISTS enterprises (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  count_tokutei   INTEGER DEFAULT 0,
  count_jisshu23  INTEGER DEFAULT 0,
  count_jisshu1   INTEGER DEFAULT 0,
  entry_date_jisshu1 DATE,
  resp_name       TEXT,
  resp_date       DATE,
  instr_name      TEXT,
  instr_date      DATE,
  life_name       TEXT,
  life_date       DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Schedule cells (年間スケジュール)
CREATE TABLE IF NOT EXISTS schedule_cells (
  id              BIGSERIAL PRIMARY KEY,
  enterprise_id   TEXT NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  fiscal_year     INTEGER NOT NULL,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  type            TEXT NOT NULL DEFAULT 'none' CHECK (type IN ('audit','visit','none')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  UNIQUE (enterprise_id, fiscal_year, month)
);

-- 3. Reports (実施報告)
CREATE TABLE IF NOT EXISTS reports (
  id              BIGSERIAL PRIMARY KEY,
  enterprise_id   TEXT NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  fiscal_year     INTEGER NOT NULL,
  month           INTEGER NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('audit','visit')),
  staff           TEXT,
  report_date     DATE,
  interviewee     TEXT,
  check_salary    TEXT,
  check_log       TEXT,
  v_staff         TEXT,
  v_date          DATE,
  v_interviewee   TEXT,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (enterprise_id, fiscal_year, month)
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedule_ent_year ON schedule_cells(enterprise_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_reports_ent_year  ON reports(enterprise_id, fiscal_year);

-- 5. Enable RLS (Row Level Security) — allow all for now (protected by service_role key on server)
ALTER TABLE enterprises    ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports        ENABLE ROW LEVEL SECURITY;

-- Allow server (service_role) to do everything — anon access blocked
CREATE POLICY "service_role_all_enterprises"    ON enterprises    FOR ALL USING (true);
CREATE POLICY "service_role_all_schedule_cells" ON schedule_cells FOR ALL USING (true);
CREATE POLICY "service_role_all_reports"        ON reports        FOR ALL USING (true);
