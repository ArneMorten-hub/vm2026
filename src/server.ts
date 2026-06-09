import { getDB, calcPoints, type MatchRow } from "./db";
import { generateToken, getUserByToken, requireAuth, requireAdmin } from "./auth";
import { specialCategories, allTeams, groups } from "./data";
import { sendSubmissionEmail } from "./email";
import { join } from "path";

const db = getDB();
const PORT = 3000;
// Frist: 11. juni 2026 kl. 21:00 CEST = 19:00 UTC
const DEADLINE = new Date("2026-06-11T19:00:00.000Z");
// Sluttspill åpner: 27. juni 2026
const KNOCKOUT_OPENS = new Date("2026-06-27T00:00:00.000Z");

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
const err = (msg: string, status = 400) => json({ error: msg }, status);
const isPastDeadline = () => new Date() > DEADLINE;

async function serveStatic(path: string): Promise<Response> {
  const safe = path === "/" ? "/index.html" : path;
  const file = Bun.file(join(import.meta.dir, "../public", safe));
  if (await file.exists()) return new Response(file);
  return new Response(Bun.file(join(import.meta.dir, "../public/index.html")));
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === "OPTIONS") return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
    });

    // ── Auth ──────────────────────────────────────────────────────────────────
    if (path === "/api/auth/login-or-register" && method === "POST") {
      const { name, email } = await req.json() as any;
      if (!name?.trim()) return err("Navn kreves");
      if (!email?.trim() || !email.includes("@")) return err("Gyldig e-postadresse kreves");
      if (name.trim().length < 2) return err("Navn må være minst 2 tegn");

      let u = db.query<any, string>(
        "SELECT * FROM users WHERE LOWER(email) = LOWER(?)"
      ).get(email.trim());

      if (!u) {
        const isAdmin = (db.query("SELECT COUNT(*) as c FROM users").get() as any).c === 0 ? 1 : 0;
        const r = db.run(
          "INSERT INTO users (name, email, is_admin) VALUES (?,?,?)",
          [name.trim(), email.trim().toLowerCase(), isAdmin]
        );
        u = db.query<any, number>("SELECT * FROM users WHERE id=?").get(r.lastInsertRowid as number);
      }

      const token = generateToken();
      db.run(
        "INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)",
        [token, u.id, new Date(Date.now() + 60 * 86400000).toISOString()]
      );
      return json({
        token,
        user: { id: u.id, name: u.name, email: u.email, isAdmin: !!u.is_admin, submittedAt: u.submitted_at },
      });
    }

    if (path === "/api/auth/me") {
      const u = requireAuth(db, req);
      if (u instanceof Response) return u;
      return json({ id: u.id, name: u.name, email: u.email, isAdmin: !!u.is_admin, submittedAt: u.submitted_at });
    }

    // ── Data ─────────────────────────────────────────────────────────────────
    if (path === "/api/matches")
      return json(db.query<MatchRow, []>("SELECT * FROM matches ORDER BY match_date,match_time,id").all());
    if (path === "/api/teams") return json(allTeams);
    if (path === "/api/teams-with-flags") {
      const rows = db.query<{ name: string; flag: string }, []>("SELECT name,flag FROM teams").all();
      return json(Object.fromEntries(rows.map(r => [r.name, r.flag])));
    }
    if (path === "/api/groups-meta") {
      const meta: Record<string, { teams: { name: string; flag: string }[] }> = {};
      for (const [g, gd] of Object.entries(groups)) meta[g] = { teams: gd.teams };
      return json(meta);
    }
    if (path === "/api/special-categories") return json(specialCategories);
    if (path === "/api/deadline") return json({ deadline: DEADLINE.toISOString() });

    // ── Match predictions (H/U/B) ─────────────────────────────────────────────
    if (path === "/api/my-predictions") {
      const u = requireAuth(db, req);
      if (u instanceof Response) return u;
      return json(db.query("SELECT match_id, result FROM predictions WHERE user_id=?").all(u.id));
    }

    if (path.startsWith("/api/predictions/match/") && method === "POST") {
      const u = requireAuth(db, req);
      if (u instanceof Response) return u;
      if (u.submitted_at) return err("Du har allerede sendt inn tippingen din – den er låst");

      const id = parseInt(path.split("/").pop()!);
      const match = db.query<MatchRow, number>("SELECT * FROM matches WHERE id=?").get(id);
      if (!match) return err("Kampen finnes ikke", 404);
      if (match.status === "finished") return err("Kampen er ferdig spilt");
      if (match.stage === "group" && isPastDeadline()) return err("Fristen for gruppespill er ute");

      const { result } = await req.json() as any;
      if (!["H", "U", "B"].includes(result)) return err("Ugyldig tips – må være H, U eller B");

      db.run(
        `INSERT INTO predictions (user_id,match_id,result) VALUES (?,?,?)
         ON CONFLICT(user_id,match_id) DO UPDATE SET result=excluded.result,updated_at=datetime('now')`,
        [u.id, id, result]
      );
      return json({ ok: true });
    }

    // ── Special predictions ───────────────────────────────────────────────────
    if (path === "/api/my-special") {
      const u = requireAuth(db, req);
      if (u instanceof Response) return u;
      const rows = db.query<{ category: string; value: string }, number>(
        "SELECT category,value FROM special_predictions WHERE user_id=?"
      ).all(u.id);
      return json(Object.fromEntries(rows.map(r => [r.category, r.value])));
    }

    if (path.startsWith("/api/predictions/special/") && method === "POST") {
      const u = requireAuth(db, req);
      if (u instanceof Response) return u;
      if (u.submitted_at) return err("Du har allerede sendt inn tippingen din – den er låst");
      if (isPastDeadline()) return err("Fristen er ute");

      const cat = path.split("/").pop()!;
      if (!specialCategories.find(c => c.id === cat)) return err("Ukjent kategori");
      const { value } = await req.json() as any;
      if (!value?.toString().trim()) return err("Mangler svar");

      db.run(
        `INSERT INTO special_predictions (user_id,category,value) VALUES (?,?,?)
         ON CONFLICT(user_id,category) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`,
        [u.id, cat, value.toString().trim()]
      );
      return json({ ok: true });
    }

    // ── Standings predictions ─────────────────────────────────────────────────
    if (path === "/api/my-standings") {
      const u = requireAuth(db, req);
      if (u instanceof Response) return u;
      const rows = db.query<{ group_name: string; position: number; team: string }, number>(
        "SELECT group_name,position,team FROM standings_predictions WHERE user_id=? ORDER BY group_name,position"
      ).all(u.id);
      const result: Record<string, Record<number, string>> = {};
      for (const r of rows) {
        if (!result[r.group_name]) result[r.group_name] = {};
        result[r.group_name][r.position] = r.team;
      }
      return json(result);
    }

    if (path.startsWith("/api/predictions/standings/") && method === "POST") {
      const u = requireAuth(db, req);
      if (u instanceof Response) return u;
      if (u.submitted_at) return err("Du har allerede sendt inn tippingen din – den er låst");
      if (isPastDeadline()) return err("Fristen er ute");

      const parts = path.split("/");
      const group = parts[parts.length - 2];
      const pos = parseInt(parts[parts.length - 1]);
      if (!groups[group] || pos < 1 || pos > 4) return err("Ugyldig gruppe/posisjon");
      const { team } = await req.json() as any;
      if (!team?.trim()) return err("Mangler lag");
      const validTeams = groups[group].teams.map(t => t.name);
      if (!validTeams.includes(team)) return err("Laget er ikke i denne gruppen");

      db.run(
        `INSERT INTO standings_predictions (user_id,group_name,position,team) VALUES (?,?,?,?)
         ON CONFLICT(user_id,group_name,position) DO UPDATE SET team=excluded.team,updated_at=datetime('now')`,
        [u.id, group, pos, team]
      );
      return json({ ok: true });
    }

    // ── Submit & lock ─────────────────────────────────────────────────────────
    if (path === "/api/submit" && method === "POST") {
      const u = requireAuth(db, req);
      if (u instanceof Response) return u;
      if (u.submitted_at) return err("Du har allerede sendt inn tippingen din");

      db.run("UPDATE users SET submitted_at = datetime('now') WHERE id = ?", [u.id]);

      // Send email async – don't block response
      sendSubmissionEmail(db, u.id, u.name, u.email).catch(e => {
        console.error("[E-post] Feil:", e.message);
      });

      return json({ ok: true, submittedAt: new Date().toISOString() });
    }

    // ── Leaderboard ───────────────────────────────────────────────────────────
    if (path === "/api/leaderboard") {
      const users = db.query<{ id: number; name: string }, []>(
        "SELECT id,name FROM users ORDER BY created_at"
      ).all();
      const finishedMatches = db.query<MatchRow, []>("SELECT * FROM matches WHERE status='finished'").all();
      const specialAnswers = Object.fromEntries(
        (db.query<{ category: string; value: string }, []>("SELECT category,value FROM special_answers").all())
          .map(a => [a.category, a.value.toLowerCase()])
      );
      const standingsAnswers = db.query<{ group_name: string; position: number; team: string }, []>(
        "SELECT group_name,position,team FROM standings_answers"
      ).all();
      const saMap: Record<string, Record<number, string>> = {};
      for (const r of standingsAnswers) {
        if (!saMap[r.group_name]) saMap[r.group_name] = {};
        saMap[r.group_name][r.position] = r.team;
      }

      const board = users.map(user => {
        let matchPts = 0, correctResults = 0, predicted = 0;
        for (const m of finishedMatches) {
          const p = db.query<{ result: string }, [number, number]>(
            "SELECT result FROM predictions WHERE user_id=? AND match_id=?"
          ).get(user.id, m.id);
          if (p && m.home_score !== null && m.away_score !== null) {
            predicted++;
            const pts = calcPoints(p.result, m.home_score, m.away_score, m.stage);
            matchPts += pts;
            if (pts > 0) correctResults++;
          }
        }

        let specialPts = 0;
        const userSpecials = db.query<{ category: string; value: string }, number>(
          "SELECT category,value FROM special_predictions WHERE user_id=?"
        ).all(user.id);
        for (const sp of userSpecials) {
          if (specialAnswers[sp.category] && sp.value.toLowerCase() === specialAnswers[sp.category])
            specialPts += 20;
        }

        let standingsPts = 0, standingBonus = 0;
        const userStandings = db.query<{ group_name: string; position: number; team: string }, number>(
          "SELECT group_name,position,team FROM standings_predictions WHERE user_id=?"
        ).all(user.id);
        const userStMap: Record<string, Record<number, string>> = {};
        for (const r of userStandings) {
          if (!userStMap[r.group_name]) userStMap[r.group_name] = {};
          userStMap[r.group_name][r.position] = r.team;
        }
        for (const [g, positions] of Object.entries(saMap)) {
          let groupCorrect = 0;
          for (const [pos, team] of Object.entries(positions)) {
            if (userStMap[g]?.[+pos] === team) { standingsPts += 3; groupCorrect++; }
          }
          if (groupCorrect === 4) standingBonus += 10;
        }

        const uRow = db.query<{ submitted_at: string | null }, number>(
          "SELECT submitted_at FROM users WHERE id=?"
        ).get(user.id);

        return {
          id: user.id, name: user.name,
          matchPoints: matchPts, specialPoints: specialPts,
          standingsPoints: standingsPts, standingsBonus: standingBonus,
          totalPoints: matchPts + specialPts + standingsPts + standingBonus,
          predicted, correctResults,
          specialCount: userSpecials.length,
          standingsCount: userStandings.length,
          isSubmitted: !!uRow?.submitted_at,
        };
      });

      board.sort((a, b) => b.totalPoints - a.totalPoints);
      return json(board);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────
    if (path === "/api/admin/users") {
      const admin = requireAdmin(db, req);
      if (admin instanceof Response) return admin;
      return json(db.query("SELECT id,name,email,is_admin,submitted_at,created_at FROM users ORDER BY created_at").all());
    }

    if (path.startsWith("/api/admin/user/") && path.endsWith("/predictions")) {
      const admin = requireAdmin(db, req);
      if (admin instanceof Response) return admin;
      const uid = parseInt(path.split("/")[4]);
      const preds = db.query<any, number>(
        `SELECT p.match_id,p.result,m.home_team,m.away_team,m.stage,m.group_name,m.matchday,
                m.match_date,m.match_time,m.label,m.home_score as actual_home,m.away_score as actual_away,m.status
         FROM predictions p JOIN matches m ON p.match_id=m.id
         WHERE p.user_id=? ORDER BY m.match_date,m.match_time,m.id`
      ).all(uid);
      const specials = db.query<{ category: string; value: string }, number>(
        "SELECT category,value FROM special_predictions WHERE user_id=?"
      ).all(uid);
      const standings = db.query<any, number>(
        "SELECT group_name,position,team FROM standings_predictions WHERE user_id=? ORDER BY group_name,position"
      ).all(uid);
      const user = db.query<{ name: string; email: string; submitted_at: string | null }, number>(
        "SELECT name,email,submitted_at FROM users WHERE id=?"
      ).get(uid);
      return json({ user, predictions: preds, specials, standings });
    }

    if (path.startsWith("/api/admin/match/") && method === "POST") {
      const admin = requireAdmin(db, req);
      if (admin instanceof Response) return admin;
      const id = parseInt(path.split("/").pop()!);
      const body = await req.json() as any;
      const updates: string[] = []; const vals: unknown[] = [];
      if (body.homeScore !== undefined && body.awayScore !== undefined) {
        updates.push("home_score=?", "away_score=?");
        vals.push(body.homeScore, body.awayScore);
      }
      if (body.homeTeam !== undefined) { updates.push("home_team=?"); vals.push(body.homeTeam); }
      if (body.awayTeam !== undefined) { updates.push("away_team=?"); vals.push(body.awayTeam); }
      if (body.status !== undefined) { updates.push("status=?"); vals.push(body.status); }
      if (body.matchTime !== undefined) { updates.push("match_time=?"); vals.push(body.matchTime); }
      if (body.matchDate !== undefined) { updates.push("match_date=?"); vals.push(body.matchDate); }
      if (!updates.length) return err("Ingen felter å oppdatere");
      vals.push(id);
      db.run(`UPDATE matches SET ${updates.join(",")} WHERE id=?`, vals);
      return json({ ok: true });
    }

    if (path === "/api/admin/special-answers" && method === "GET") {
      const admin = requireAdmin(db, req);
      if (admin instanceof Response) return admin;
      return json(Object.fromEntries(
        (db.query<any, []>("SELECT category,value FROM special_answers").all())
          .map((r: any) => [r.category, r.value])
      ));
    }

    if (path.startsWith("/api/admin/special-answer/") && method === "POST") {
      const admin = requireAdmin(db, req);
      if (admin instanceof Response) return admin;
      const cat = path.split("/").pop()!;
      const { value } = await req.json() as any;
      if (!value?.trim()) return err("Mangler fasit");
      db.run(
        `INSERT INTO special_answers (category,value) VALUES (?,?)
         ON CONFLICT(category) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`,
        [cat, value.trim()]
      );
      return json({ ok: true });
    }

    if (path === "/api/admin/standings-answers" && method === "GET") {
      const admin = requireAdmin(db, req);
      if (admin instanceof Response) return admin;
      const rows = db.query<any, []>("SELECT group_name,position,team FROM standings_answers").all();
      const result: Record<string, Record<number, string>> = {};
      for (const r of rows) {
        if (!result[r.group_name]) result[r.group_name] = {};
        result[r.group_name][r.position] = r.team;
      }
      return json(result);
    }

    if (path.startsWith("/api/admin/standings-answer/") && method === "POST") {
      const admin = requireAdmin(db, req);
      if (admin instanceof Response) return admin;
      const parts = path.split("/");
      const group = parts[parts.length - 2];
      const pos = parseInt(parts[parts.length - 1]);
      const { team } = await req.json() as any;
      db.run(
        `INSERT INTO standings_answers (group_name,position,team) VALUES (?,?,?)
         ON CONFLICT(group_name,position) DO UPDATE SET team=excluded.team`,
        [group, pos, team]
      );
      return json({ ok: true });
    }

    // ── Excel eksport ─────────────────────────────────────────────────────────
    if (path === "/api/admin/export" && method === "GET") {
      const admin = requireAdmin(db, req);
      if (admin instanceof Response) return admin;
      try {
        const XLSX = await import("xlsx");
        const users = db.query<any, []>("SELECT * FROM users ORDER BY created_at").all();
        const groupMatches = db.query<MatchRow, []>(
          "SELECT * FROM matches WHERE stage='group' ORDER BY group_name,matchday,id"
        ).all();
        const allPreds = db.query<any, []>("SELECT * FROM predictions").all();
        const allStandings = db.query<any, []>(
          "SELECT * FROM standings_predictions ORDER BY user_id,group_name,position"
        ).all();
        const allSpecials = db.query<any, []>("SELECT * FROM special_predictions").all();

        const predMap: Record<number, Record<number, string>> = {};
        for (const p of allPreds) {
          if (!predMap[p.user_id]) predMap[p.user_id] = {};
          predMap[p.user_id][p.match_id] = p.result;
        }
        const standMap: Record<number, Record<string, Record<number, string>>> = {};
        for (const s of allStandings) {
          if (!standMap[s.user_id]) standMap[s.user_id] = {};
          if (!standMap[s.user_id][s.group_name]) standMap[s.user_id][s.group_name] = {};
          standMap[s.user_id][s.group_name][s.position] = s.team;
        }
        const specMap: Record<number, Record<string, string>> = {};
        for (const s of allSpecials) {
          if (!specMap[s.user_id]) specMap[s.user_id] = {};
          specMap[s.user_id][s.category] = s.value;
        }

        const GROUPS = "ABCDEFGHIJKL".split("");
        const wb = XLSX.utils.book_new();

        // Sheet 1: Kamptips
        const mHeaders = ["Navn", "E-post", "Sendt inn", ...groupMatches.map(
          (m: MatchRow) => `${m.home_team} vs ${m.away_team} (Gr.${m.group_name} R${m.matchday})`
        )];
        const mData = [mHeaders, ...users.map((u: any) => [
          u.name, u.email, u.submitted_at ? "Ja" : "Nei",
          ...groupMatches.map((m: MatchRow) => predMap[u.id]?.[m.id] || "")
        ])];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mData), "Kamptips");

        // Sheet 2: Tabellsvar
        const sHeaders = ["Navn", "E-post"];
        for (const g of GROUPS) for (let p = 1; p <= 4; p++) sHeaders.push(`Gr.${g} ${p}. plass`);
        const sData = [sHeaders, ...users.map((u: any) => {
          const row = [u.name, u.email];
          for (const g of GROUPS) for (let p = 1; p <= 4; p++) row.push(standMap[u.id]?.[g]?.[p] || "");
          return row;
        })];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sData), "Tabellsvar");

        // Sheet 3: Spesialtips
        const spHeaders = ["Navn", "E-post", ...specialCategories.map(c => c.label)];
        const spData = [spHeaders, ...users.map((u: any) => [
          u.name, u.email,
          ...specialCategories.map(c => specMap[u.id]?.[c.id] || "")
        ])];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(spData), "Spesialtips");

        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        return new Response(buf, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="vm2026-tipping-${new Date().toISOString().slice(0, 10)}.xlsx"`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (e: any) {
        console.error("Excel-feil:", e);
        return err("Excel-eksport feilet: " + e.message);
      }
    }

    return serveStatic(path);
  },
});

console.log(`⚽ VM 2026 Konkurranse → http://localhost:${PORT}`);
