import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

export const UNLOCK_REQUIRED = "UNLOCK_REQUIRED";


export type GateSession = { unlocked?: boolean };

export function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "resenha-gate",
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax" as const,
      path: "/",
    },

  };
}

export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function isUnlocked() {
  const session = await useSession<GateSession>(sessionConfig());
  return !!session.data.unlocked;
}

export async function requireUnlocked() {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked) throw new Error(UNLOCK_REQUIRED);
  return session;
}


export async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
