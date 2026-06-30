import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, calcPoints, type MatchRow } from "../src/db";
import { generateToken, requireAuth, requireAdmin } from "../src/auth";
import { specialCategories, allTeams, groups } from "../src/data";

const DEADLINE = new Date("2026-06-11T19:00:00.000Z");
const isPastDeadline = () => new Date() > DEADLINE;

function ok(res: VercelResponse, data: unknown, status = 200) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(status).json(data);
}
function err(res: VercelResponse, msg: string, status = 400) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(status).json({ error: msg });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const pool = getPool();
  await pool.query("ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_winner VARCHAR(1)");
  // Reconstruct path from Vercel's catch-all param
  const parts = Array.isArray(req.query.path) ? req.query.path : req.query.path ? [req.query.path] : [];
  const path = "/api/" + parts.join("/");
  const method = req.method!;
  const body = req.body;

  // ── Auth ────────────────────────────────────────────────────────────────────
  if (path === "/api/auth/login-or-register" && method === "POST") {
    const { name } = body as any;
    if (!name?.trim()) return err(res, "Navn kreves");
    if (name.trim().length < 2) return err(res, "Navn må være minst 2 tegn");

    let u = (await pool.query("SELECT * FROM users WHERE LOWER(name) = LOWER($1)", [name.trim()])).rows[0];

    if (!u) {
      return err(res, "Fann ikkje dette namnet. Skriv namnet heilt likt som du registrerte deg med fyrste gong — store og små bokstavar, bindestrek og mellomrom tel.");
    }

    const token = generateToken();
    await pool.query(
      "INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,$3)",
      [token, u.id, new Date(Date.now() + 60 * 86400000).toISOString()]
    );
    return ok(res, { token, user: { id: u.id, name: u.name, email: u.email, isAdmin: !!u.is_admin, submittedAt: u.submitted_at } });
  }

  if (path === "/api/auth/me") {
    const u = await requireAuth(pool, req.headers as any);
    if ("error" in u) return err(res, u.error, u.status);
    return ok(res, { id: u.id, name: u.name, email: u.email, isAdmin: !!u.is_admin, submittedAt: u.submitted_at });
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  if (path === "/api/matches")
    return ok(res, (await pool.query<MatchRow>("SELECT * FROM matches ORDER BY match_date,match_time,id")).rows);

  if (path === "/api/teams") return ok(res, allTeams);

  if (path === "/api/teams-with-flags") {
    const rows = (await pool.query<{ name: string; flag: string }>("SELECT name,flag FROM teams")).rows;
    return ok(res, Object.fromEntries(rows.map(r => [r.name, r.flag])));
  }

  if (path === "/api/groups-meta") {
    const meta: Record<string, { teams: { name: string; flag: string }[] }> = {};
    for (const [g, gd] of Object.entries(groups)) meta[g] = { teams: gd.teams };
    return ok(res, meta);
  }

  if (path === "/api/special-categories") return ok(res, specialCategories);
  if (path === "/api/deadline") return ok(res, { deadline: DEADLINE.toISOString() });

  // ── Match predictions ───────────────────────────────────────────────────────
  if (path === "/api/my-predictions") {
    const u = await requireAuth(pool, req.headers as any);
    if ("error" in u) return err(res, u.error, u.status);
    return ok(res, (await pool.query("SELECT match_id, result, home_score_pred, away_score_pred FROM predictions WHERE user_id=$1", [u.id])).rows);
  }

  const matchPredMatch = path.match(/^\/api\/predictions\/match\/(\d+)$/);
  if (matchPredMatch && method === "POST") {
    const u = await requireAuth(pool, req.headers as any);
    if ("error" in u) return err(res, u.error, u.status);

    const id = parseInt(matchPredMatch[1]);
    const match = (await pool.query<MatchRow>("SELECT * FROM matches WHERE id=$1", [id])).rows[0];
    if (!match) return err(res, "Kampen finnes ikke", 404);
    if (match.status === "finished") return err(res, "Kampen er ferdig spilt");
    if (match.stage === "group") {
      if (u.submitted_at) return err(res, "Du har allerede sendt inn tippingen din – den er låst");
      if (isPastDeadline()) return err(res, "Fristen for gruppespill er ute");
    }

    const { result, homeScorePred, awayScorePred } = body as any;
    const validResults = match.stage === "group" ? ["H", "U", "B"] : ["H", "B"];
    if (!validResults.includes(result)) return err(res, "Ugyldig tips");

    const hsp = homeScorePred != null && awayScorePred != null ? parseInt(homeScorePred) : null;
    const asp = homeScorePred != null && awayScorePred != null ? parseInt(awayScorePred) : null;

    await pool.query(
      `INSERT INTO predictions (user_id,match_id,result,home_score_pred,away_score_pred) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT(user_id,match_id) DO UPDATE SET result=EXCLUDED.result,home_score_pred=EXCLUDED.home_score_pred,away_score_pred=EXCLUDED.away_score_pred,updated_at=NOW()`,
      [u.id, id, result, hsp, asp]
    );
    return ok(res, { ok: true });
  }

  // ── Special predictions ────────────────────────────────────────────────────
  if (path === "/api/my-special") {
    const u = await requireAuth(pool, req.headers as any);
    if ("error" in u) return err(res, u.error, u.status);
    const rows = (await pool.query("SELECT category,value FROM special_predictions WHERE user_id=$1", [u.id])).rows;
    return ok(res, Object.fromEntries(rows.map((r: any) => [r.category, r.value])));
  }

  const specialPredMatch = path.match(/^\/api\/predictions\/special\/(.+)$/);
  if (specialPredMatch && method === "POST") {
    const u = await requireAuth(pool, req.headers as any);
    if ("error" in u) return err(res, u.error, u.status);
    if (u.submitted_at) return err(res, "Du har allerede sendt inn tippingen din – den er låst");
    if (isPastDeadline()) return err(res, "Fristen er ute");

    const cat = specialPredMatch[1];
    if (!specialCategories.find(c => c.id === cat)) return err(res, "Ukjent kategori");
    const { value } = body as any;
    if (!value?.toString().trim()) return err(res, "Mangler svar");

    await pool.query(
      `INSERT INTO special_predictions (user_id,category,value) VALUES ($1,$2,$3)
       ON CONFLICT(user_id,category) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,
      [u.id, cat, value.toString().trim()]
    );
    return ok(res, { ok: true });
  }

  // ── Standings predictions ───────────────────────────────────────────────────
  if (path === "/api/my-standings") {
    const u = await requireAuth(pool, req.headers as any);
    if ("error" in u) return err(res, u.error, u.status);
    const rows = (await pool.query("SELECT group_name,position,team FROM standings_predictions WHERE user_id=$1 ORDER BY group_name,position", [u.id])).rows;
    const result: Record<string, Record<number, string>> = {};
    for (const r of rows) {
      if (!result[r.group_name]) result[r.group_name] = {};
      result[r.group_name][r.position] = r.team;
    }
    return ok(res, result);
  }

  const standingsPredMatch = path.match(/^\/api\/predictions\/standings\/([A-Z])\/(\d)$/);
  if (standingsPredMatch && method === "POST") {
    const u = await requireAuth(pool, req.headers as any);
    if ("error" in u) return err(res, u.error, u.status);
    if (u.submitted_at) return err(res, "Du har allerede sendt inn tippingen din – den er låst");
    if (isPastDeadline()) return err(res, "Fristen er ute");

    const group = standingsPredMatch[1];
    const pos = parseInt(standingsPredMatch[2]);
    if (!groups[group] || pos < 1 || pos > 4) return err(res, "Ugyldig gruppe/posisjon");
    const { team } = body as any;
    if (!team?.trim()) return err(res, "Mangler lag");
    const validTeams = groups[group].teams.map((t: any) => t.name);
    if (!validTeams.includes(team)) return err(res, "Laget er ikke i denne gruppen");

    await pool.query(
      `INSERT INTO standings_predictions (user_id,group_name,position,team) VALUES ($1,$2,$3,$4)
       ON CONFLICT(user_id,group_name,position) DO UPDATE SET team=EXCLUDED.team,updated_at=NOW()`,
      [u.id, group, pos, team]
    );
    return ok(res, { ok: true });
  }

  // ── Submit & lock ──────────────────────────────────────────────────────────
  if (path === "/api/submit" && method === "POST") {
    const u = await requireAuth(pool, req.headers as any);
    if ("error" in u) return err(res, u.error, u.status);
    if (u.submitted_at) return err(res, "Du har allerede sendt inn tippingen din");

    await pool.query("UPDATE users SET submitted_at = NOW() WHERE id = $1", [u.id]);

    return ok(res, { ok: true, submittedAt: new Date().toISOString() });
  }

  // ── Leaderboard ───────────────────────────────────────────────────────────
  if (path === "/api/leaderboard") {
    const users = (await pool.query("SELECT id,name FROM users ORDER BY created_at")).rows;
    const finishedMatches = (await pool.query<MatchRow>("SELECT * FROM matches WHERE status='finished'")).rows;
    const specialAnswers = Object.fromEntries(
      (await pool.query("SELECT category,value FROM special_answers")).rows.map((a: any) => [a.category, a.value.toLowerCase()])
    );
    const standingsAnswers = (await pool.query("SELECT group_name,position,team FROM standings_answers")).rows;
    const saMap: Record<string, Record<number, string>> = {};
    for (const r of standingsAnswers) {
      if (!saMap[r.group_name]) saMap[r.group_name] = {};
      saMap[r.group_name][r.position] = r.team;
    }

    const allPreds = (await pool.query("SELECT user_id,match_id,result,home_score_pred,away_score_pred FROM predictions")).rows;
    const predMap: Record<number, Record<number, {result:string,hsp:number|null,asp:number|null}>> = {};
    for (const p of allPreds) {
      if (!predMap[p.user_id]) predMap[p.user_id] = {};
      predMap[p.user_id][p.match_id] = { result: p.result, hsp: p.home_score_pred, asp: p.away_score_pred };
    }

    const allSpecials = (await pool.query("SELECT user_id,category,value FROM special_predictions")).rows;
    const specMap: Record<number, Record<string, string>> = {};
    for (const s of allSpecials) {
      if (!specMap[s.user_id]) specMap[s.user_id] = {};
      specMap[s.user_id][s.category] = s.value;
    }

    const allStandings = (await pool.query("SELECT user_id,group_name,position,team FROM standings_predictions")).rows;
    const userStMap: Record<number, Record<string, Record<number, string>>> = {};
    for (const r of allStandings) {
      if (!userStMap[r.user_id]) userStMap[r.user_id] = {};
      if (!userStMap[r.user_id][r.group_name]) userStMap[r.user_id][r.group_name] = {};
      userStMap[r.user_id][r.group_name][r.position] = r.team;
    }

    const allUsers = (await pool.query("SELECT id,submitted_at FROM users")).rows;
    const submittedMap: Record<number, string | null> = {};
    for (const u of allUsers) submittedMap[u.id] = u.submitted_at;

    const board = users.map((user: any) => {
      let matchPts = 0, knockoutPts = 0, knockoutScoreBonus = 0, correctResults = 0, predicted = 0;
      for (const m of finishedMatches) {
        const p = predMap[user.id]?.[m.id];
        if (p && m.home_score !== null && m.away_score !== null) {
          predicted++;
          const pts = calcPoints(p.result, m.home_score, m.away_score, m.stage, p.hsp, p.asp, m.match_winner);
          if (m.stage === "group") {
            matchPts += pts;
          } else {
            const basePts = calcPoints(p.result, m.home_score, m.away_score, m.stage, null, null, m.match_winner);
            knockoutPts += basePts;
            knockoutScoreBonus += pts - basePts;
          }
          if (pts > 0) correctResults++;
        }
      }

      const userSpecials = Object.entries(specMap[user.id] || {});
      let specialPts = 0;
      for (const [cat, val] of userSpecials) {
        if (specialAnswers[cat] && val.toLowerCase() === specialAnswers[cat]) {
          const catDef = specialCategories.find(c => c.id === cat);
          specialPts += catDef?.points ?? 10;
        }
      }

      let standingsPts = 0, standingBonus = 0;
      for (const [g, positions] of Object.entries(saMap)) {
        let groupCorrect = 0;
        for (const [pos, team] of Object.entries(positions)) {
          if (userStMap[user.id]?.[g]?.[+pos] === team) { standingsPts += 3; groupCorrect++; }
        }
        if (groupCorrect === 4) standingBonus += 10;
      }

      return {
        id: user.id, name: user.name,
        matchPoints: matchPts, knockoutPoints: knockoutPts, knockoutScoreBonus,
        specialPoints: specialPts,
        standingsPoints: standingsPts, standingsBonus: standingBonus,
        totalPoints: matchPts + knockoutPts + knockoutScoreBonus + specialPts + standingsPts + standingBonus,
        predicted, correctResults,
        specialCount: userSpecials.length,
        standingsCount: Object.values(userStMap[user.id] || {}).reduce((s, g) => s + Object.keys(g).length, 0),
        isSubmitted: !!submittedMap[user.id],
      };
    });

    board.sort((a: any, b: any) => b.totalPoints - a.totalPoints);
    return ok(res, board);
  }

  // ── Admin ──────────────────────────────────────────────────────────────────
  if (path === "/api/admin/users") {
    const admin = await requireAdmin(pool, req.headers as any);
    if ("error" in admin) return err(res, admin.error, admin.status);
    return ok(res, (await pool.query("SELECT id,name,email,is_admin,submitted_at,created_at FROM users ORDER BY created_at")).rows);
  }

  const adminUserPredMatch = path.match(/^\/api\/admin\/user\/(\d+)\/predictions$/);
  if (adminUserPredMatch) {
    const admin = await requireAdmin(pool, req.headers as any);
    if ("error" in admin) return err(res, admin.error, admin.status);
    const uid = parseInt(adminUserPredMatch[1]);
    const preds = (await pool.query(
      `SELECT p.match_id,p.result,p.home_score_pred,p.away_score_pred,m.home_team,m.away_team,m.stage,m.group_name,m.matchday,
              m.match_date,m.match_time,m.label,m.home_score as actual_home,m.away_score as actual_away,m.status
       FROM predictions p JOIN matches m ON p.match_id=m.id
       WHERE p.user_id=$1 ORDER BY m.match_date,m.match_time,m.id`, [uid]
    )).rows;
    const specials = (await pool.query("SELECT category,value FROM special_predictions WHERE user_id=$1", [uid])).rows;
    const standings = (await pool.query("SELECT group_name,position,team FROM standings_predictions WHERE user_id=$1 ORDER BY group_name,position", [uid])).rows;
    const user = (await pool.query("SELECT name,email,submitted_at FROM users WHERE id=$1", [uid])).rows[0];
    return ok(res, { user, predictions: preds, specials, standings });
  }

  const adminMatchMatch = path.match(/^\/api\/admin\/match\/(\d+)$/);
  if (adminMatchMatch && method === "POST") {
    const admin = await requireAdmin(pool, req.headers as any);
    if ("error" in admin) return err(res, admin.error, admin.status);
    const id = parseInt(adminMatchMatch[1]);
    const updates: string[] = []; const vals: unknown[] = [];
    if (body.homeScore !== undefined && body.awayScore !== undefined) {
      updates.push(`home_score=$${vals.length+1}`, `away_score=$${vals.length+2}`);
      vals.push(body.homeScore, body.awayScore);
    }
    if (body.homeTeam !== undefined) { updates.push(`home_team=$${vals.length+1}`); vals.push(body.homeTeam); }
    if (body.awayTeam !== undefined) { updates.push(`away_team=$${vals.length+1}`); vals.push(body.awayTeam); }
    if (body.status !== undefined) { updates.push(`status=$${vals.length+1}`); vals.push(body.status); }
    if (body.matchTime !== undefined) { updates.push(`match_time=$${vals.length+1}`); vals.push(body.matchTime); }
    if (body.matchDate !== undefined) { updates.push(`match_date=$${vals.length+1}`); vals.push(body.matchDate); }
    if (body.matchWinner !== undefined) { updates.push(`match_winner=$${vals.length+1}`); vals.push(body.matchWinner || null); }
    if (!updates.length) return err(res, "Ingen felter å oppdatere");
    vals.push(id);
    await pool.query(`UPDATE matches SET ${updates.join(",")} WHERE id=$${vals.length}`, vals);
    return ok(res, { ok: true });
  }

  if (path === "/api/admin/special-answers" && method === "GET") {
    const admin = await requireAdmin(pool, req.headers as any);
    if ("error" in admin) return err(res, admin.error, admin.status);
    return ok(res, Object.fromEntries(
      (await pool.query("SELECT category,value FROM special_answers")).rows.map((r: any) => [r.category, r.value])
    ));
  }

  const specialAnswerMatch = path.match(/^\/api\/admin\/special-answer\/(.+)$/);
  if (specialAnswerMatch && method === "POST") {
    const admin = await requireAdmin(pool, req.headers as any);
    if ("error" in admin) return err(res, admin.error, admin.status);
    const cat = specialAnswerMatch[1];
    const { value } = body as any;
    if (!value?.trim()) return err(res, "Mangler fasit");
    await pool.query(
      `INSERT INTO special_answers (category,value) VALUES ($1,$2)
       ON CONFLICT(category) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,
      [cat, value.trim()]
    );
    return ok(res, { ok: true });
  }

  if (path === "/api/admin/standings-answers" && method === "GET") {
    const admin = await requireAdmin(pool, req.headers as any);
    if ("error" in admin) return err(res, admin.error, admin.status);
    const rows = (await pool.query("SELECT group_name,position,team FROM standings_answers")).rows;
    const result: Record<string, Record<number, string>> = {};
    for (const r of rows) {
      if (!result[r.group_name]) result[r.group_name] = {};
      result[r.group_name][r.position] = r.team;
    }
    return ok(res, result);
  }

  const standingsAnswerMatch = path.match(/^\/api\/admin\/standings-answer\/([A-Z])\/(\d)$/);
  if (standingsAnswerMatch && method === "POST") {
    const admin = await requireAdmin(pool, req.headers as any);
    if ("error" in admin) return err(res, admin.error, admin.status);
    const group = standingsAnswerMatch[1];
    const pos = parseInt(standingsAnswerMatch[2]);
    const { team } = body as any;
    await pool.query(
      `INSERT INTO standings_answers (group_name,position,team) VALUES ($1,$2,$3)
       ON CONFLICT(group_name,position) DO UPDATE SET team=EXCLUDED.team`,
      [group, pos, team]
    );
    return ok(res, { ok: true });
  }

  // ── Admin: lås opp bruker ─────────────────────────────────────────────────
  const adminUnlockMatch = path.match(/^\/api\/admin\/user\/(\d+)\/unlock$/);
  if (adminUnlockMatch && method === "POST") {
    const admin = await requireAdmin(pool, req.headers as any);
    if ("error" in admin) return err(res, admin.error, admin.status);
    const uid = parseInt(adminUnlockMatch[1]);
    await pool.query("UPDATE users SET submitted_at = NULL WHERE id = $1", [uid]);
    return ok(res, { ok: true });
  }

  // ── Excel eksport ──────────────────────────────────────────────────────────
  if (path === "/api/admin/export" && method === "GET") {
    const admin = await requireAdmin(pool, req.headers as any);
    if ("error" in admin) return err(res, admin.error, admin.status);
    try {
      const XLSX = await import("xlsx");
      const users = (await pool.query("SELECT * FROM users ORDER BY created_at")).rows;
      const groupMatches = (await pool.query<MatchRow>("SELECT * FROM matches WHERE stage='group' ORDER BY group_name,matchday,id")).rows;
      const allPreds = (await pool.query("SELECT * FROM predictions")).rows;
      const allStandingRows = (await pool.query("SELECT * FROM standings_predictions ORDER BY user_id,group_name,position")).rows;
      const allSpecialRows = (await pool.query("SELECT * FROM special_predictions")).rows;

      const predMap: Record<number, Record<number, string>> = {};
      for (const p of allPreds) {
        if (!predMap[p.user_id]) predMap[p.user_id] = {};
        predMap[p.user_id][p.match_id] = p.result;
      }
      const standMap: Record<number, Record<string, Record<number, string>>> = {};
      for (const s of allStandingRows) {
        if (!standMap[s.user_id]) standMap[s.user_id] = {};
        if (!standMap[s.user_id][s.group_name]) standMap[s.user_id][s.group_name] = {};
        standMap[s.user_id][s.group_name][s.position] = s.team;
      }
      const specMap: Record<number, Record<string, string>> = {};
      for (const s of allSpecialRows) {
        if (!specMap[s.user_id]) specMap[s.user_id] = {};
        specMap[s.user_id][s.category] = s.value;
      }

      const GROUPS = "ABCDEFGHIJKL".split("");
      const wb = XLSX.utils.book_new();

      const mHeaders = ["Navn", "E-post", "Sendt inn", ...groupMatches.map(
        (m: MatchRow) => `${m.home_team} vs ${m.away_team} (Gr.${m.group_name} R${m.matchday})`
      )];
      const mData = [mHeaders, ...users.map((u: any) => [
        u.name, u.email, u.submitted_at ? "Ja" : "Nei",
        ...groupMatches.map((m: MatchRow) => predMap[u.id]?.[m.id] || "")
      ])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mData), "Kamptips");

      const sHeaders = ["Navn", "E-post"];
      for (const g of GROUPS) for (let p = 1; p <= 4; p++) sHeaders.push(`Gr.${g} ${p}. plass`);
      const sData = [sHeaders, ...users.map((u: any) => {
        const row = [u.name, u.email];
        for (const g of GROUPS) for (let p = 1; p <= 4; p++) row.push(standMap[u.id]?.[g]?.[p] || "");
        return row;
      })];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sData), "Tabellsvar");

      const spHeaders = ["Navn", "E-post", ...specialCategories.map((c: any) => c.label)];
      const spData = [spHeaders, ...users.map((u: any) => [
        u.name, u.email,
        ...specialCategories.map((c: any) => specMap[u.id]?.[c.id] || "")
      ])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(spData), "Spesialtips");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="vm2026-tipping-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      return res.status(200).send(buf);
    } catch (e: any) {
      return err(res, "Excel-eksport feilet: " + e.message);
    }
  }

  // ── ESPN sync (POST by admin, GET by Vercel cron) ──
  if (path === "/api/sync") {
    const cronSecret = process.env.CRON_SECRET;
    const isCron = method === "GET" && cronSecret &&
      req.headers["authorization"] === `Bearer ${cronSecret}`;
    if (!isCron) {
      const admin = await requireAdmin(pool, req.headers as any);
      if ("error" in admin) return err(res, admin.error, admin.status);
    }

    const ESPN_NAMES: Record<string,string> = {
      "United States": "USA",
      "Côte d'Ivoire": "Ivory Coast", "Cote d'Ivoire": "Ivory Coast",
      "Congo DR": "DR Congo", "Democratic Republic of Congo": "DR Congo",
      "Cape Verde": "Cabo Verde",
    };
    const norm = (n: string) => ESPN_NAMES[n] || n;

    // Fetch ESPN scoreboard for next 22 days in parallel
    const today = new Date();
    const dates = Array.from({length:22},(_,i)=>{
      const d = new Date(today.getTime()+i*86400000);
      return d.toISOString().slice(0,10).replace(/-/g,"");
    });
    const fetched = await Promise.allSettled(
      dates.map(ds =>
        fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${ds}`)
          .then(r => r.ok ? r.json() : null)
      )
    );
    const events: any[] = [];
    for (const f of fetched) {
      if (f.status === "fulfilled" && f.value?.events) events.push(...f.value.events);
    }

    let updated = 0, notFound = 0;
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      const homeC = comp.competitors?.find((c:any) => c.homeAway === "home");
      const awayC = comp.competitors?.find((c:any) => c.homeAway === "away");
      if (!homeC || !awayC) continue;

      const espnHome = norm(homeC.team.displayName);
      const espnAway = norm(awayC.team.displayName);
      const pre = comp.status.type.state === "pre";
      const homeScore = pre ? null : (parseInt(homeC.score) ?? null);
      const awayScore = pre ? null : (parseInt(awayC.score) ?? null);
      const finished = comp.status.type.completed === true;
      const live = comp.status.type.state === "in";
      const status = finished ? "finished" : live ? "live" : "upcoming";
      const evDate = ev.date?.slice(0,10);
      const winnerC = finished ? comp.competitors?.find((c:any) => c.winner === true) : null;
      const matchWinner = winnerC ? (winnerC.homeAway === "home" ? "H" : "B") : null;

      // Try direct team name match
      const direct = await pool.query(
        "SELECT id FROM matches WHERE home_team=$1 AND away_team=$2", [espnHome, espnAway]
      );
      if (direct.rows.length > 0) {
        await pool.query(
          "UPDATE matches SET status=$1,home_score=$2,away_score=$3,match_winner=$4 WHERE id=$5",
          [status, homeScore, awayScore, matchWinner, direct.rows[0].id]
        );
        updated++; continue;
      }

      // Try to fill a TBD slot in the correct stage
      const txt = ((ev.name||"")+" "+(comp.notes||[]).map((n:any)=>n.text||"").join(" ")).toLowerCase();
      let stage: string|null = null;
      if (/round of 32|1\/16/.test(txt)) stage = "r32";
      else if (/round of 16|1\/8/.test(txt)) stage = "r16";
      else if (/quarter/.test(txt)) stage = "qf";
      else if (/semi/.test(txt)) stage = "sf";
      else if (/third|bronze/.test(txt)) stage = "3rd";
      else if (/\bfinal\b/.test(txt)) stage = "final";

      if (stage) {
        const tbd = await pool.query(
          `SELECT id FROM matches WHERE stage=$1 AND (home_team='TBD' OR away_team='TBD')
           ORDER BY ABS(EXTRACT(EPOCH FROM (match_date::date - $2::date))) LIMIT 1`,
          [stage, evDate]
        );
        if (tbd.rows.length > 0) {
          await pool.query(
            "UPDATE matches SET home_team=$1,away_team=$2,status=$3,home_score=$4,away_score=$5,match_date=$6,match_winner=$7 WHERE id=$8",
            [espnHome, espnAway, status, homeScore, awayScore, evDate, matchWinner, tbd.rows[0].id]
          );
          updated++;
        } else { notFound++; }
      } else { notFound++; }
    }

    return ok(res, { ok: true, updated, notFound, total: events.length });
  }

  return err(res, "Ikke funnet", 404);
}
