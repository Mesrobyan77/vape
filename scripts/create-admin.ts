/**
 * npm run admin:create -- --email admin@example.com --name "Store Admin"
 * Password: ADMIN_PASSWORD env var, or an interactive hidden prompt.
 * The admin must enrol TOTP MFA on first sign-in (/admin). No default admin exists anywhere.
 */
import { stdin, stdout } from "node:process";
import { connectDb, disconnectDb } from "../src/server/db";
import { hashPassword, normalizeEmail, passwordProblems } from "../src/server/auth/passwords";
import { User } from "../src/server/models";
import { audit } from "../src/server/services/audit";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.exit(130);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main(): Promise<void> {
  const emailArg = arg("email");
  const name = arg("name") ?? "Administrator";
  if (!emailArg || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailArg)) throw new Error("Usage: npm run admin:create -- --email you@example.com [--name \"Name\"]");
  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden("Password: "));
  const problems = passwordProblems(password);
  if (problems.length) throw new Error(`Password rejected: ${problems.join(", ")} (10–128 chars, at least two character classes)`);
  if (password.length < 14) throw new Error("Admin passwords must be at least 14 characters.");

  await connectDb();
  const email = normalizeEmail(emailArg);
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === "admin") throw new Error("An administrator with this email already exists.");
    existing.role = "admin";
    existing.passwordHash = await hashPassword(password);
    await existing.save();
    console.log(`Promoted existing account ${email} to admin.`);
  } else {
    await User.create({ email, name, passwordHash: await hashPassword(password), role: "admin" });
    console.log(`Created admin ${email}. Sign in at /admin to enrol MFA.`);
  }
  await audit({ action: "admin.created_via_cli", targetType: "user", targetId: email });
  await disconnectDb();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
