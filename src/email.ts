import { Pool } from "pg";
import { specialCategories } from "./data";

const GROUPS = "ABCDEFGHIJKL".split("");

let _transporter: any = null;

async function getTransporter() {
  if (_transporter) return _transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  try {
    const nm = await import("nodemailer");
    _transporter = nm.default.createTransport({ service: "gmail", auth: { user, pass } });
    return _transporter;
  } catch {
    return null;
  }
}

export async function sendSubmissionEmail(pool: Pool, userId: number, userName: string, userEmail: string): Promise<void> {
  const t = await getTransporter();
  if (!t) { console.log(`[E-post] Ikke konfigurert – hopper over for ${userName}`); return; }

  const groupMatches = (await pool.query("SELECT * FROM matches WHERE stage='group' ORDER BY group_name,matchday,id")).rows;
  const preds = (await pool.query("SELECT match_id,result FROM predictions WHERE user_id=$1", [userId])).rows;
  const predMap: Record<number, string> = {};
  for (const p of preds) predMap[p.match_id] = p.result;

  const standings = (await pool.query("SELECT group_name,position,team FROM standings_predictions WHERE user_id=$1 ORDER BY group_name,position", [userId])).rows;
  const standMap: Record<string, Record<number, string>> = {};
  for (const s of standings) {
    if (!standMap[s.group_name]) standMap[s.group_name] = {};
    standMap[s.group_name][s.position] = s.team;
  }

  const specials = (await pool.query("SELECT category,value FROM special_predictions WHERE user_id=$1", [userId])).rows;
  const specMap: Record<string, string> = {};
  for (const s of specials) specMap[s.category] = s.value;

  const resultLabel = (r: string) => r === "H" ? "🏠 Hjemme" : r === "U" ? "🤝 Uavgjort" : r === "B" ? "✈️ Borte" : "–";

  const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;color:#111827;background:#f9fafb">
<div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:white;padding:28px 32px;border-radius:16px;text-align:center;margin-bottom:28px">
  <div style="font-size:40px;margin-bottom:8px">⚽</div>
  <h1 style="margin:0 0 6px;font-size:26px">VM-konkurranse 2026</h1>
  <p style="margin:0;opacity:.9">Tipping levert av <strong>${userName}</strong></p>
  <p style="margin:4px 0 0;opacity:.7;font-size:13px">${userEmail}</p>
</div>

<h2 style="color:#2563eb;border-bottom:2px solid #dbeafe;padding-bottom:8px">📋 Tabellplasseringer</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <tr style="background:#eff6ff">
    <th style="padding:10px 14px;text-align:left;font-size:13px;color:#2563eb">Gruppe</th>
    <th style="padding:10px;text-align:center;font-size:13px;color:#2563eb">1. plass</th>
    <th style="padding:10px;text-align:center;font-size:13px;color:#2563eb">2. plass</th>
    <th style="padding:10px;text-align:center;font-size:13px;color:#2563eb">3. plass</th>
    <th style="padding:10px;text-align:center;font-size:13px;color:#2563eb">4. plass</th>
  </tr>
  ${GROUPS.map((g, i) => {
    const gst = standMap[g] || {};
    return `<tr style="border-top:1px solid #e5e7eb;background:${i % 2 === 0 ? "white" : "#f9fafb"}">
      <td style="padding:10px 14px;font-weight:700">Gruppe ${g}</td>
      ${[1,2,3,4].map(p => `<td style="padding:10px;text-align:center">${gst[p] || '<span style="color:#9ca3af">–</span>'}</td>`).join("")}
    </tr>`;
  }).join("")}
</table>

<h2 style="color:#2563eb;border-bottom:2px solid #dbeafe;padding-bottom:8px">⚽ Gruppespill – Kamptips</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <tr style="background:#eff6ff">
    <th style="padding:10px 14px;text-align:left;font-size:13px;color:#2563eb">Kamp</th>
    <th style="padding:10px;text-align:center;font-size:12px;color:#2563eb">Gr.</th>
    <th style="padding:10px;text-align:center;font-size:12px;color:#2563eb">Runde</th>
    <th style="padding:10px;text-align:center;font-size:13px;color:#2563eb">Tips</th>
  </tr>
  ${groupMatches.map((m: any, i: number) => {
    const r = predMap[m.id];
    return `<tr style="border-top:1px solid #e5e7eb;background:${i % 2 === 0 ? "white" : "#f9fafb"}">
      <td style="padding:9px 14px;font-size:13px">${m.home_team} – ${m.away_team}</td>
      <td style="padding:9px;text-align:center;font-size:12px;color:#6b7280">${m.group_name}</td>
      <td style="padding:9px;text-align:center;font-size:12px;color:#6b7280">${m.matchday}</td>
      <td style="padding:9px;text-align:center;font-weight:700;color:${r ? "#2563eb" : "#9ca3af"}">${r ? resultLabel(r) : "–"}</td>
    </tr>`;
  }).join("")}
</table>

<h2 style="color:#2563eb;border-bottom:2px solid #dbeafe;padding-bottom:8px">🌟 Spesialtips</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
  <tr style="background:#eff6ff">
    <th style="padding:10px 14px;text-align:left;font-size:13px;color:#2563eb">Kategori</th>
    <th style="padding:10px 14px;text-align:left;font-size:13px;color:#2563eb">Svar</th>
  </tr>
  ${specialCategories.map((cat, i) => `
    <tr style="border-top:1px solid #e5e7eb;background:${i % 2 === 0 ? "white" : "#f9fafb"}">
      <td style="padding:9px 14px;font-size:13px">${cat.label}</td>
      <td style="padding:9px 14px;font-weight:700;color:${specMap[cat.id] ? "#111827" : "#9ca3af"}">${specMap[cat.id] || "–"}</td>
    </tr>`).join("")}
</table>

<p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px">Sendt automatisk fra VM-konkurranse 2026 · ${new Date().toLocaleString("no-NO")}</p>
</body></html>`;

  await t.sendMail({
    from: `"VM 2026 Tipping" <${process.env.GMAIL_USER}>`,
    to: "arne.morten.oen@gmail.com",
    subject: `⚽ VM-tipping levert – ${userName}`,
    html,
  });

  console.log(`[E-post] Sendt til arne.morten.oen@gmail.com for ${userName}`);
}
