// Regression: currencies must be readable by signed-in users only (migration 0008).
// Runs against the live backend. Signed-in check needs SUPABASE_TEST_ACCESS_TOKEN
// or a minted session at ~/.cache/lovable-auth/session.json.
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const url = process.env.VITE_SUPABASE_URL ?? "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

function accessToken(): string | undefined {
  if (process.env.SUPABASE_TEST_ACCESS_TOKEN) return process.env.SUPABASE_TEST_ACCESS_TOKEN;
  const file = path.join(homedir(), ".cache/lovable-auth/session.json");
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf8"))?.session?.access_token;
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const token = accessToken();

describe.skipIf(!url || !key)("currencies access", () => {
  it("denies anonymous reads", async () => {
    const anon = createClient(url, key, opts);
    const { data, error } = await anon.from("currencies").select("code");
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it.skipIf(!token)("allows signed-in reads", async () => {
    const authed = createClient(url, key, {
      ...opts,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await authed.from("currencies").select("code");
    expect(error).toBeNull();
    expect(data?.map((r) => r.code)).toContain("KWD");
  });
});
