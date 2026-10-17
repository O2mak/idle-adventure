-- 계정
CREATE TABLE IF NOT EXISTS accounts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash       TEXT NOT NULL,
  pw_salt       TEXT NOT NULL,
  nickname      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  session_hash  TEXT,                       -- 현재 유효한 접속(세션) 토큰의 해시. 새로 로그인하면 교체되어 기존 접속이 끊김
  session_at    INTEGER,
  last_seen     INTEGER,
  fail_count    INTEGER NOT NULL DEFAULT 0, -- 로그인 연속 실패 횟수
  locked_until  INTEGER NOT NULL DEFAULT 0, -- 잠금 해제 시각(ms)
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_session ON accounts(session_hash);

-- 진행 데이터 (계정당 1개, JSON)
CREATE TABLE IF NOT EXISTS saves (
  account_id  INTEGER PRIMARY KEY REFERENCES accounts(id),
  season      INTEGER NOT NULL,
  data        TEXT NOT NULL,
  play_time   REAL NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);

-- 무한 모드 시즌 랭킹 (시즌마다 계정당 1줄: 최고 층과 그 층에 처음 도달한 시각)
CREATE TABLE IF NOT EXISTS endless_rank (
  season      INTEGER NOT NULL,
  account_id  INTEGER NOT NULL REFERENCES accounts(id),
  floor       INTEGER NOT NULL,
  reached_at  INTEGER NOT NULL,
  PRIMARY KEY (season, account_id)
);
CREATE INDEX IF NOT EXISTS idx_endless_order ON endless_rank(season, floor DESC, reached_at ASC);

-- 의심스러운 저장 기록 (운영자 확인용)
CREATE TABLE IF NOT EXISTS flags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL,
  at          INTEGER NOT NULL,
  reason      TEXT NOT NULL
);

-- 게임 안에서 받은 의견 (운영자가 확인)
CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id  INTEGER NOT NULL,
  nickname    TEXT NOT NULL,
  category    TEXT NOT NULL,
  body        TEXT NOT NULL,
  context     TEXT,
  at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_at ON feedback(at DESC);
