import { generateSync } from "otplib";
import { beforeAll, describe, expect, it } from "vitest";
import type { MeResponse } from "@/lib/api/types";
import { GET as csrfRoute } from "@/app/api/v1/auth/csrf/route";
import { POST as registerRoute } from "@/app/api/v1/auth/register/route";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { POST as logoutRoute } from "@/app/api/v1/auth/logout/route";
import { GET as meRoute, PATCH as mePatchRoute } from "@/app/api/v1/auth/me/route";
import { PATCH as passwordRoute } from "@/app/api/v1/auth/me/password/route";
import { POST as forgotRoute } from "@/app/api/v1/auth/forgot-password/route";
import { POST as resetRoute } from "@/app/api/v1/auth/reset-password/route";
import { GET as sessionsRoute } from "@/app/api/v1/auth/sessions/route";
import { DELETE as sessionDeleteRoute } from "@/app/api/v1/auth/sessions/[id]/route";
import { POST as mfaSetupRoute } from "@/app/api/v1/auth/mfa/setup/route";
import { POST as mfaActivateRoute } from "@/app/api/v1/auth/mfa/activate/route";
import { POST as mfaVerifyRoute } from "@/app/api/v1/auth/mfa/verify/route";
import { GET as dashboardRoute } from "@/app/api/v1/admin/dashboard/route";
import { GET as addressesRoute, POST as addressCreateRoute } from "@/app/api/v1/account/addresses/route";
import { PATCH as addressPatchRoute, DELETE as addressDeleteRoute } from "@/app/api/v1/account/addresses/[id]/route";
import { STRONG_PASSWORD, TestClient, registeredUser, seed, shopper } from "../support/fixtures";

async function capturedEmails(to: string) {
  const { CapturedEmail } = await import("@/server/models");
  const { runJobsOnce } = await import("@/server/jobs");
  await runJobsOnce();
  return CapturedEmail.find({ to }).sort({ createdAt: -1 }).lean();
}

const me = (c: TestClient) => c.call<{ data: MeResponse }>(meRoute, "GET", "/api/v1/auth/me");

describe("registration and login", () => {
  beforeAll(async () => {
    await seed();
  });

  it("registers with an identical response for new and existing emails (no enumeration)", async () => {
    const c = await shopper();
    const body = { email: "dup@example.com", password: STRONG_PASSWORD, name: "Dup", locale: "en" };
    const first = await c.call(registerRoute, "POST", "/api/v1/auth/register", { body });
    const second = await c.call(registerRoute, "POST", "/api/v1/auth/register", { body: { ...body, password: "Another-Pass-123" } });
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(second.body).toEqual(first.body);
    const { User } = await import("@/server/models");
    expect(await User.countDocuments({ email: "dup@example.com" })).toBe(1);
    const mails = await capturedEmails("dup@example.com");
    expect(mails.map((m) => m.template).sort()).toEqual(["account_exists", "welcome"]);
  });

  it("normalizes email and rejects weak passwords / forged roles", async () => {
    const c = await shopper();
    const weak = await c.call<{ error: { code: string } }>(registerRoute, "POST", "/api/v1/auth/register", { body: { email: "w@example.com", password: "short", name: "W" } });
    expect(weak.status).toBe(422);
    const forged = await c.call(registerRoute, "POST", "/api/v1/auth/register", { body: { email: "evil@example.com", password: STRONG_PASSWORD, name: "E", role: "admin" } });
    expect(forged.status).toBe(422);
    const { User } = await import("@/server/models");
    expect(await User.findOne({ email: "evil@example.com" })).toBeNull();
    await c.call(registerRoute, "POST", "/api/v1/auth/register", { body: { email: "  MixedCase@Example.COM ", password: STRONG_PASSWORD, name: "M" } });
    expect(await User.findOne({ email: "mixedcase@example.com" })).not.toBeNull();
  });

  it("logs in with generic failures and rotates the session id (fixation defence)", async () => {
    const { client, email, password } = await registeredUser();
    const meRes = await me(client);
    expect(meRes.body.data.user?.email).toBe(email);
    expect(meRes.body.data.user?.role).toBe("customer");

    const attacker = new TestClient();
    await attacker.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const fixated = attacker.cookies.get("vh_sid")!;
    const login = await attacker.call(loginRoute, "POST", "/api/v1/auth/login", { body: { email, password } });
    expect(login.status).toBe(200);
    expect(attacker.cookies.get("vh_sid")).not.toBe(fixated);
    // the pre-login session id is dead
    const stale = new TestClient();
    stale.cookies.set("vh_sid", fixated);
    expect((await me(stale)).body.data.user).toBeNull();

    const wrongPw = await attacker.call<{ error: { code: string; message: string } }>(loginRoute, "POST", "/api/v1/auth/login", { body: { email, password: "Wrong-password-1" } });
    const noUser = await attacker.call<{ error: { code: string; message: string } }>(loginRoute, "POST", "/api/v1/auth/login", { body: { email: "nobody@example.com", password: "Wrong-password-1" } });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body.error).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(noUser.body.error.message).toBe(wrongPw.body.error.message);
  });

  it("logout revokes the session server-side (cookie replay fails)", async () => {
    const { client } = await registeredUser();
    const sid = client.cookies.get("vh_sid")!;
    expect((await client.call(logoutRoute, "POST", "/api/v1/auth/logout")).status).toBe(204);
    const replay = new TestClient();
    replay.cookies.set("vh_sid", sid);
    expect((await me(replay)).body.data.user).toBeNull();
  });

  it("expired sessions are rejected", async () => {
    const { client } = await registeredUser();
    const { Session } = await import("@/server/models");
    const { hashSessionToken } = await import("@/server/auth/session");
    await Session.updateOne({ tokenHash: hashSessionToken(client.cookies.get("vh_sid")!) }, { $set: { idleExpiresAt: new Date(Date.now() - 1000) } });
    expect((await me(client)).body.data.user).toBeNull();
  });

  it("rate limits login attempts per account (429 + Retry-After)", async () => {
    const c = new TestClient("203.0.113.7");
    await c.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    let last = 0;
    let retryAfter: string | null = null;
    for (let i = 0; i < 10; i += 1) {
      const res = await c.call(loginRoute, "POST", "/api/v1/auth/login", { body: { email: "victim@example.com", password: "Wrong-password-1" } });
      last = res.status;
      retryAfter = res.headers.get("retry-after");
    }
    expect(last).toBe(429);
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("updates the profile and lists/revokes own sessions only", async () => {
    const { client, email, password } = await registeredUser();
    const patched = await client.call<{ data: { user: { name: string; locale: string } } }>(mePatchRoute, "PATCH", "/api/v1/auth/me", { body: { name: "Renamed", locale: "ru" } });
    expect(patched.body.data.user).toMatchObject({ name: "Renamed", locale: "ru" });
    const second = new TestClient();
    await second.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    await second.call(loginRoute, "POST", "/api/v1/auth/login", { body: { email, password } });
    const list = await client.call<{ data: { id: string; current: boolean }[] }>(sessionsRoute, "GET", "/api/v1/auth/sessions");
    expect(list.body.data).toHaveLength(2);
    const other = list.body.data.find((s) => !s.current)!;
    expect((await client.call(sessionDeleteRoute, "DELETE", `/api/v1/auth/sessions/${other.id}`, { params: { id: other.id } })).status).toBe(204);
    expect((await me(second)).body.data.user).toBeNull();
    // cannot revoke someone else's session
    const stranger = await registeredUser();
    const strangerSessions = await stranger.client.call<{ data: { id: string }[] }>(sessionsRoute, "GET", "/api/v1/auth/sessions");
    const foreign = strangerSessions.body.data[0]!.id;
    expect((await client.call(sessionDeleteRoute, "DELETE", `/api/v1/auth/sessions/${foreign}`, { params: { id: foreign } })).status).toBe(404);
  });

  it("changing the password revokes other sessions and rotates the current one", async () => {
    const { client, email, password } = await registeredUser();
    const other = new TestClient();
    await other.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    await other.call(loginRoute, "POST", "/api/v1/auth/login", { body: { email, password } });
    const before = client.cookies.get("vh_sid");
    const res = await client.call(passwordRoute, "PATCH", "/api/v1/auth/me/password", { body: { currentPassword: password, newPassword: "Brand-New-Pass-42" } });
    expect(res.status).toBe(200);
    expect(client.cookies.get("vh_sid")).not.toBe(before);
    expect((await me(client)).body.data.user?.email).toBe(email);
    expect((await me(other)).body.data.user).toBeNull();
    const bad = await client.call(passwordRoute, "PATCH", "/api/v1/auth/me/password", { body: { currentPassword: "nope-nope-nope", newPassword: "Brand-New-Pass-43" } });
    expect(bad.status).toBe(422);
  });
});

describe("password reset", () => {
  it("issues a single-use, time-limited token and revokes sessions", async () => {
    const { client, email } = await registeredUser();
    const anon = await shopper();
    expect((await anon.call(forgotRoute, "POST", "/api/v1/auth/forgot-password", { body: { email, locale: "en" } })).status).toBe(202);
    expect((await anon.call(forgotRoute, "POST", "/api/v1/auth/forgot-password", { body: { email: "ghost@example.com" } })).status).toBe(202);
    const mail = (await capturedEmails(email)).find((m) => m.template === "password_reset")!;
    const token = /token=([A-Za-z0-9_%-]+)/.exec(mail.text)![1]!;
    const decoded = decodeURIComponent(token);
    const { PasswordReset } = await import("@/server/models");
    const stored = await PasswordReset.findOne({}).sort({ createdAt: -1 }).lean();
    expect(stored!.tokenHash).not.toContain(decoded); // only the hash is stored

    const ok = await anon.call(resetRoute, "POST", "/api/v1/auth/reset-password", { body: { token: decoded, password: "Reset-Pass-2026" } });
    expect(ok.status).toBe(204);
    expect((await me(client)).body.data.user).toBeNull(); // all sessions revoked
    const anon2 = await shopper();
    const reuse = await anon2.call<{ error: { details: { path: string }[] } }>(resetRoute, "POST", "/api/v1/auth/reset-password", { body: { token: decoded, password: "Reset-Pass-2027" } });
    expect(reuse.status).toBe(422);
    expect(reuse.body.error.details[0]!.path).toBe("token");
    const login = await anon2.call(loginRoute, "POST", "/api/v1/auth/login", { body: { email, password: "Reset-Pass-2026" } });
    expect(login.status).toBe(200);
  });

  it("rejects expired tokens", async () => {
    const { email } = await registeredUser();
    const anon = await shopper();
    await anon.call(forgotRoute, "POST", "/api/v1/auth/forgot-password", { body: { email } });
    const mail = (await capturedEmails(email)).find((m) => m.template === "password_reset")!;
    const token = decodeURIComponent(/token=([A-Za-z0-9_%-]+)/.exec(mail.text)![1]!);
    const { PasswordReset } = await import("@/server/models");
    await PasswordReset.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await anon.call(resetRoute, "POST", "/api/v1/auth/reset-password", { body: { token, password: "Reset-Pass-2026" } });
    expect(res.status).toBe(422);
  });
});

describe("admin MFA", () => {
  it("enforces enrolment, verification, replay protection and recovery codes", async () => {
    const { User } = await import("@/server/models");
    const { hashPassword } = await import("@/server/auth/passwords");
    await User.create({ email: "mfa-admin@example.com", name: "A", passwordHash: await hashPassword(STRONG_PASSWORD), role: "admin" });
    const c = new TestClient();
    await c.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const login = await c.call<{ data: { mfa: string } }>(loginRoute, "POST", "/api/v1/auth/login", { body: { email: "mfa-admin@example.com", password: STRONG_PASSWORD } });
    expect(login.body.data.mfa).toBe("enroll");
    const blocked = await c.call<{ error: { code: string; details: { mfa: string } } }>(dashboardRoute, "GET", "/api/v1/admin/dashboard");
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toMatchObject({ code: "MFA_REQUIRED", details: { mfa: "enroll" } });

    const setup = await c.call<{ data: { secret: string; otpauthUrl: string; qrDataUrl: string } }>(mfaSetupRoute, "POST", "/api/v1/auth/mfa/setup");
    expect(setup.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(setup.body.data.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const secret = setup.body.data.secret;
    const stored = await User.findOne({ email: "mfa-admin@example.com" }).lean();
    expect(stored!.mfa.pendingSecretEnc).not.toContain(secret); // encrypted at rest

    expect((await c.call(mfaActivateRoute, "POST", "/api/v1/auth/mfa/activate", { body: { code: "000000" } })).status).toBe(422);
    const code = generateSync({ secret });
    const activated = await c.call<{ data: { recoveryCodes: string[] } }>(mfaActivateRoute, "POST", "/api/v1/auth/mfa/activate", { body: { code } });
    expect(activated.status).toBe(200);
    const recovery = activated.body.data.recoveryCodes;
    expect(recovery).toHaveLength(10);
    expect((await c.call(dashboardRoute, "GET", "/api/v1/admin/dashboard")).status).toBe(200);

    // New login requires verification; the code used for activation cannot be replayed.
    const c2 = new TestClient();
    await c2.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    const login2 = await c2.call<{ data: { mfa: string } }>(loginRoute, "POST", "/api/v1/auth/login", { body: { email: "mfa-admin@example.com", password: STRONG_PASSWORD } });
    expect(login2.body.data.mfa).toBe("verify");
    expect((await c2.call(mfaVerifyRoute, "POST", "/api/v1/auth/mfa/verify", { body: { code } })).status).toBe(422);
    expect((await c2.call(dashboardRoute, "GET", "/api/v1/admin/dashboard")).status).toBe(403);

    // Recovery code works exactly once.
    const viaRecovery = await c2.call(mfaVerifyRoute, "POST", "/api/v1/auth/mfa/verify", { body: { recoveryCode: recovery[0] } });
    expect(viaRecovery.status).toBe(200);
    expect((await c2.call(dashboardRoute, "GET", "/api/v1/admin/dashboard")).status).toBe(200);
    const c3 = new TestClient();
    await c3.call(csrfRoute, "GET", "/api/v1/auth/csrf");
    await c3.call(loginRoute, "POST", "/api/v1/auth/login", { body: { email: "mfa-admin@example.com", password: STRONG_PASSWORD } });
    expect((await c3.call(mfaVerifyRoute, "POST", "/api/v1/auth/mfa/verify", { body: { recoveryCode: recovery[0] } })).status).toBe(422);

    const { AuditLog } = await import("@/server/models");
    const actions = (await AuditLog.find({ actorEmail: "mfa-admin@example.com" }).lean()).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["admin.login", "mfa.enabled", "mfa.verified_recovery", "mfa.verify_failed"]));
  });

  it("customers cannot use MFA endpoints", async () => {
    const { client } = await registeredUser();
    expect((await client.call(mfaSetupRoute, "POST", "/api/v1/auth/mfa/setup")).status).toBe(403);
  });
});

describe("addresses", () => {
  it("CRUD is scoped to the owner", async () => {
    const owner = await registeredUser();
    const other = await registeredUser();
    const addr = { fullName: "Ani P", phone: "+37499123456", region: "lori", city: "Vanadzor", line1: "Tigran Mets 5" };
    const created = await owner.client.call<{ data: { id: string; isDefault: boolean }[] }>(addressCreateRoute, "POST", "/api/v1/account/addresses", { body: addr });
    expect(created.status).toBe(201);
    expect(created.body.data[0]!.isDefault).toBe(true);
    const id = created.body.data[0]!.id;
    expect((await other.client.call(addressPatchRoute, "PATCH", `/api/v1/account/addresses/${id}`, { body: { city: "Hacked" }, params: { id } })).status).toBe(404);
    expect((await other.client.call(addressDeleteRoute, "DELETE", `/api/v1/account/addresses/${id}`, { params: { id } })).status).toBe(404);
    const patched = await owner.client.call<{ data: { city: string }[] }>(addressPatchRoute, "PATCH", `/api/v1/account/addresses/${id}`, { body: { city: "Gyumri" }, params: { id } });
    expect(patched.body.data[0]!.city).toBe("Gyumri");
    expect((await owner.client.call(addressCreateRoute, "POST", "/api/v1/account/addresses", { body: { ...addr, region: "mars" } })).status).toBe(422);
    const list = await other.client.call<{ data: unknown[] }>(addressesRoute, "GET", "/api/v1/account/addresses");
    expect(list.body.data).toEqual([]);
    const unauth = new TestClient();
    expect((await unauth.call(addressesRoute, "GET", "/api/v1/account/addresses")).status).toBe(401);
  });
});
