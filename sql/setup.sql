-- =============================================
-- CheckIn App - Supabase SQL Setup
-- Run this in Supabase > SQL Editor > New query
-- =============================================

-- Questions table
CREATE TABLE questions (
  id          TEXT PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('scale','yesno','multiple_choice','text')),
  options     JSONB DEFAULT '[]',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- User settings (reminders, frequency, etc.)
CREATE TABLE user_settings (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency      TEXT NOT NULL DEFAULT 'daily',   -- daily | weekly | custom
  reminder_time  TEXT NOT NULL DEFAULT '08:00',   -- HH:MM
  reminder_email TEXT,
  weekday        INTEGER DEFAULT 1,               -- 0=Sun … 6=Sat (for weekly)
  custom_days    JSONB DEFAULT '[1,2,3,4,5]',     -- array of weekday ints (for custom)
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Check-in responses
CREATE TABLE checkins (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  answers      JSONB NOT NULL DEFAULT '{}',       -- { question_id: value, … }
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Row Level Security =====
ALTER TABLE questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins      ENABLE ROW LEVEL SECURITY;

-- questions policies
CREATE POLICY "Own questions" ON questions  FOR ALL  USING (auth.uid() = user_id);

-- user_settings policies
CREATE POLICY "Own settings"  ON user_settings FOR ALL USING (auth.uid() = user_id);

-- checkins policies
CREATE POLICY "Own checkins"  ON checkins FOR ALL USING (auth.uid() = user_id);

-- ===== Indexes =====
CREATE INDEX idx_questions_user     ON questions(user_id, sort_order);
CREATE INDEX idx_checkins_user_date ON checkins(user_id, completed_at DESC);
CREATE INDEX idx_settings_user      ON user_settings(user_id);
