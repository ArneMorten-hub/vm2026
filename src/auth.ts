import { Database } from "bun:sqlite";

export type User = {
  id: number;
  name: string;
  email: string;
  is_admin: number;
  submitted_at: string | null;
};

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function getUserByToken(db: Database, token: string): User | null {
  return db.query<User, string>(
    `SELECT u.id, u.name, u.email, u.is_admin, u.submitted_at
     FROM users u JOIN sessions s ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`
  ).get(token) ?? null;
}

const jsonRes = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export function requireAuth(db: Database, req: Request): User | Response {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return jsonRes({ error: "Ikke innlogget" }, 401);
  const user = getUserByToken(db, auth.slice(7));
  if (!user) return jsonRes({ error: "Ugyldig eller utløpt økt" }, 401);
  return user;
}

export function requireAdmin(db: Database, req: Request): User | Response {
  const u = requireAuth(db, req);
  if (u instanceof Response) return u;
  if (!u.is_admin) return jsonRes({ error: "Ingen tilgang" }, 403);
  return u;
}
