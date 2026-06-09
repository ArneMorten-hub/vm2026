// Kjør med: npx ts-node seed.ts (etter å ha satt DATABASE_URL i .env)
import { Pool } from "pg";
import { groups, generateGroupMatches, generateKnockoutMatches } from "./src/data";
import * as dotenv from "dotenv";
dotenv.config();

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const cnt = (await pool.query("SELECT COUNT(*) as c FROM teams")).rows[0].c;
  if (parseInt(cnt) > 0) { console.log("Allerede seeded."); await pool.end(); return; }

  for (const [g, gd] of Object.entries(groups))
    for (const t of gd.teams)
      await pool.query("INSERT INTO teams (name,group_name,flag) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [t.name, g, t.flag]);

  for (const m of generateGroupMatches())
    await pool.query("INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time,label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [m.homeTeam, m.awayTeam, m.stage, m.groupName, m.matchday, m.matchDate, m.matchTime, m.label]);

  for (const m of generateKnockoutMatches())
    await pool.query("INSERT INTO matches (home_team,away_team,stage,group_name,matchday,match_date,match_time,label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [m.homeTeam, m.awayTeam, m.stage, m.groupName, m.matchday, m.matchDate, m.matchTime, m.label]);

  console.log("✅ Database seeded!");
  await pool.end();
}

seed().catch(console.error);
