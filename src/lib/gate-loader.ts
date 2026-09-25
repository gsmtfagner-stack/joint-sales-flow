import { redirect } from "@tanstack/react-router";
import { ensureUnlocked } from "./gate.functions";

/** Loader guard: redirects to the password screen when the session is locked. */
export async function requireUnlockedLoader() {
  const { unlocked } = await ensureUnlocked();
  if (!unlocked) throw redirect({ to: "/entrar" });
  return { unlocked: true as const };
}
