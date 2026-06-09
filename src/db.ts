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
};

export function calcPoints(predictedResult: string, rh: number, ra: number, stage: string): number {
  const actual = rh > ra ? "H" : rh < ra ? "B" : "U";
  if (predictedResult === actual) return stage === "group" ? 3 : 5;
  return 0;
}
