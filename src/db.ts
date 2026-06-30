import { Pool } from "pg";

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 1,
    });
  }
  return _pool;
}

export type MatchRow = {
  id: number; home_team: string; away_team: string;
  stage: string; group_name: string | null; matchday: number | null;
  match_date: string | null; match_time: string | null; label: string | null;
  home_score: number | null; away_score: number | null; status: string;
  match_winner: string | null;
};

const STAGE_BASE: Record<string, number> = { group: 3, r32: 4, r16: 5, qf: 6, sf: 8, "3rd": 6, final: 12 };
const SCORE_BONUS = 3;

export function calcPoints(
  predictedResult: string, rh: number, ra: number, stage: string,
  hsp?: number | null, asp?: number | null, matchWinner?: string | null
): number {
  const actual = matchWinner ?? (rh > ra ? "H" : rh < ra ? "B" : "U");
  if (predictedResult !== actual) return 0;
  const base = STAGE_BASE[stage] ?? 3;
  const bonus = (stage !== "group" && hsp != null && asp != null && hsp === rh && asp === ra) ? SCORE_BONUS : 0;
  return base + bonus;
}
