import { Pool } from "pg";

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

export async function getUserByToken(pool: Pool, token: string): Promise<User | null> {
  const r = await pool.query<User>(
    `SELECT u.id, u.name, u.email, u.is_admin, u.submitted_at
     FROM users u JOIN sessions s ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return r.rows[0] ?? null;
}

export async function requireAuth(pool: Pool, headers: Record<string, string | string[] | undefined>): Promise<User | { error: string; status: number }> {
  const auth = (headers["authorization"] as string) || "";
  if (!auth.startsWith("Bearer ")) return { error: "Ikke innlogget", status: 401 };
  const user = await getUserByToken(pool, auth.slice(7));
  if (!user) return { error: "Ugyldig eller utløpt økt", status: 401 };
  return user;
}

export async function requireAdmin(pool: Pool, headers: Record<string, string | string[] | undefined>): Promise<User | { error: string; status: number }> {
  const u = await requireAuth(pool, headers);
  if ("error" in u) return u;
  if (!u.is_admin) return { error: "Ingen tilgang", status: 403 };
  return u;
}
