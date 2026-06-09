import { Database } from "bun:sqlite";
import { generateGroupMatches, generateKnockoutMatches, groups } from "./data";

let _db: Database;

export function getDB(): Database {
  if (!_db) {
    _db = new Database("vm2026.sqlite", { create: true });
    _db.run("PRAGMA journal_mode = WAL");
    _db.run("PRAGMA foreign_keys = ON");
    initSchema(_db);
    seedData(_db);
  }
  return _db;
}

function addColSafe(db: Database, table: string, col: string, def: string) {
  try { db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch {}
}

function initSchema(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    is_admin INTEGER DEFAULT 0,
    submitted_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  addColSafe(db, "users", "submitted_at", "TEXT");

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    group_name TEXT NOT NULL,
    flag TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    stage TEXT NOT NULL,
    group_name TEXT,
    matchday INTEGER,
    match_date TEXT,
    match_time TEXT DEFAULT '21:00',
    label TEXT,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT DEFAULT 'scheduled'
  )`);
  addColSafe(db, "matches", "match_time", "TEXT DEFAULT '21:00'");

  // Migrate predictions table if old schema (home_score/away_score → result)
  let needsMigration = false;
  try { db.query("SELECT result FROM predictions LIMIT 0").all(); }
  catch { needsMigration = true; }
  if (needsMigration) {
    try { db.query("SELECT home_score FROM predictions LIMIT 0").all(); db.run("DROP TABLE IF EXISTS predictions"); }
    catch {}
  }

  db.run(`CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    result TEXT CHECK(result IN ('H','U','B')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, match_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS special_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, category)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS special_answers (
    category TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS standings_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_name TEXT NOT NULL,
    position INTEGER NOT NULL,
    team TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, group_name, position)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS standings_answers (
    group_name TEXT NOT NULL,
    position INTEGER NOT NULL,
    team TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (group_name, position)
  )`);
}

function seedData(db: Database) {
  const cnt = db.query("SELECT COUNT(*) as c FROM teams").get() as { c: number };
  if (cnt.c > 0) return;

  const insTeam = db.prepare("INSERT OR IGNORE INTO teams (name, group_name, flag) VALUES (?, ?, ?)");
  for (const [g, gd] of Object.entries(groups))
    for (const t of gd.teams) insTeam.run(t.name, g, t.flag);

  const insMatch = db.prepare(`INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time,label) VALUES (?,?,?,?,?,?,?,?)`);
  for (const m of generateGroupMatches())
    insMatch.run(m.homeTeam, m.awayTeam, m.stage, m.groupName, m.matchday, m.matchDate, m.matchTime, m.label);
  for (const m of generateKnockoutMatches())
    insMatch.run(m.homeTeam, m.awayTeam, m.stage, m.groupName, m.matchday, m.matchDate, m.matchTime, m.label);
}

export type MatchRow = {
  id: number; home_team: string; away_team: string;
  stage: string; group_name: string | null; matchday: number | null;
  match_date: string | null; match_time: string | null; label: string | null;
  home_score: number | null; away_score: number | null; status: string;
};

// Group: 3p correct, 0p wrong. Knockout: 5p correct, 0p wrong.
export function calcPoints(predictedResult: string, rh: number, ra: number, stage: string): number {
  const actual = rh > ra ? 'H' : rh < ra ? 'B' : 'U';
  if (predictedResult === actual) return stage === 'group' ? 3 : 5;
  return 0;
}
