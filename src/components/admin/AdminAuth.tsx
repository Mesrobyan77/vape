"use client";

import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { api, isApiError, setCsrfToken } from "@/lib/api/client";
import type { LoginResponse, MfaSetupResponse } from "@/lib/api/types";
import { ME_KEY } from "@/hooks/use-me";
import { adminErrorText, Button, TextInput } from "./ui";

function AuthCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="adm-auth">
      <div className="adm-auth-card">
        <div className="adm-auth-brand">
          <span className="adm-brand-mark" aria-hidden>
            VH
          </span>
          <span className="adm-brand-text">
            Vape Hub
            <small>Admin</small>
          </span>
        </div>
        <h1 className="adm-auth-title">{title}</h1>
        {description ? <p className="adm-auth-desc">{description}</p> : null}
        {children}
      </div>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p className="adm-alert is-error" role="alert" data-testid="auth-error">
      {error}
    </p>
  ) : null;
}

export function AdminLogin() {
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await api<LoginResponse>("/auth/login", { method: "POST", body: { email, password } });
      setCsrfToken(result.csrfToken);
      if (result.user.role !== "admin") setError("This account does not have admin access.");
      await client.invalidateQueries({ queryKey: ME_KEY });
    } catch (err) {
      setError(isApiError(err) && err.code === "INVALID_CREDENTIALS" ? "The email or password is incorrect." : adminErrorText(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthCard title="Sign in" description="Administrator access to orders, catalogue and store settings.">
      <form onSubmit={submit} className="adm-stack" data-testid="admin-login">
        <ErrorLine error={error} />
        <TextInput label="Email" type="email" value={email} onChange={setEmail} required inputMode="email" testId="admin-email" />
        <TextInput label="Password" type="password" value={password} onChange={setPassword} required testId="admin-password" />
        <Button type="submit" variant="primary" size="lg" className="is-block" disabled={pending} aria-busy={pending} data-testid="admin-login-submit">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}

export function MfaVerify() {
  const client = useQueryClient();
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const body = mode === "totp" ? { code: value.replace(/\s/g, "") } : { recoveryCode: value.trim() };
      const result = await api<{ csrfToken: string }>("/auth/mfa/verify", { method: "POST", body });
      setCsrfToken(result.csrfToken);
      await client.invalidateQueries({ queryKey: ME_KEY });
    } catch (err) {
      setError(adminErrorText(err));
      setValue("");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthCard
      title="Two-factor verification"
      description={mode === "totp" ? "Enter the 6-digit code from your authenticator app." : "Enter one of your unused recovery codes. Each code works once."}
    >
      <form onSubmit={submit} className="adm-stack" data-testid="mfa-verify">
        <ErrorLine error={error} />
        <TextInput
          label={mode === "totp" ? "Authentication code" : "Recovery code"}
          value={value}
          onChange={setValue}
          required
          inputMode={mode === "totp" ? "numeric" : "text"}
          testId="mfa-code"
          placeholder={mode === "totp" ? "123456" : "xxxx-xxxx-xx"}
        />
        <Button type="submit" variant="primary" size="lg" className="is-block" disabled={pending} aria-busy={pending} data-testid="mfa-submit">
          <ShieldCheck aria-hidden /> Verify
        </Button>
        <Button type="button" variant="quiet" className="is-block" onClick={() => setMode(mode === "totp" ? "recovery" : "totp")} data-testid="mfa-toggle">
          {mode === "totp" ? "Use a recovery code instead" : "Use an authenticator code"}
        </Button>
      </form>
    </AuthCard>
  );
}

export function MfaEnroll() {
  const client = useQueryClient();
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setPending(true);
    setError(null);
    try {
      setSetup(await api<MfaSetupResponse>("/auth/mfa/setup", { method: "POST", body: {} }));
    } catch (err) {
      setError(adminErrorText(err));
    } finally {
      setPending(false);
    }
  };

  const activate = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await api<{ recoveryCodes: string[]; csrfToken: string }>("/auth/mfa/activate", { method: "POST", body: { code: code.replace(/\s/g, "") } });
      setCsrfToken(result.csrfToken);
      setRecoveryCodes(result.recoveryCodes);
    } catch (err) {
      setError(adminErrorText(err));
    } finally {
      setPending(false);
    }
  };

  if (recoveryCodes) {
    return (
      <AuthCard title="Save your recovery codes" description="Each code can be used once if you lose access to your authenticator. They will not be shown again.">
        <div className="adm-stack">
          <ul className="adm-codes" data-testid="recovery-codes">
            {recoveryCodes.map((c) => (
              <li key={c} className="adm-mono">
                {c}
              </li>
            ))}
          </ul>
          <Button variant="primary" size="lg" className="is-block" onClick={() => void client.invalidateQueries({ queryKey: ME_KEY })} data-testid="recovery-saved">
            I have saved these codes
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set up two-factor authentication" description="Administrator accounts must use an authenticator app (TOTP).">
      <div className="adm-stack">
        <ErrorLine error={error} />
        {!setup ? (
          <>
            <p className="adm-hint">Scan a QR code with Google Authenticator, 1Password, Authy or a similar app.</p>
            <Button variant="primary" size="lg" className="is-block" onClick={start} disabled={pending} aria-busy={pending} data-testid="mfa-start">
              {pending ? "Preparing…" : "Generate QR code"}
            </Button>
          </>
        ) : (
          <form onSubmit={activate} className="adm-stack" data-testid="mfa-enroll">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR code generated by the server */}
            <img src={setup.qrDataUrl} alt="QR code for your authenticator app" width={200} height={200} className="adm-qr" />
            <p className="adm-hint" style={{ textAlign: "center" }}>
              Or enter this key manually:
            </p>
            <p className="adm-copy" data-testid="mfa-secret">
              {setup.secret}
            </p>
            <TextInput label="Code from the app" value={code} onChange={setCode} required inputMode="numeric" placeholder="123456" testId="mfa-enroll-code" />
            <Button type="submit" variant="primary" size="lg" className="is-block" disabled={pending} aria-busy={pending} data-testid="mfa-activate">
              <KeyRound aria-hidden /> {pending ? "Activating…" : "Activate"}
            </Button>
          </form>
        )}
      </div>
    </AuthCard>
  );
}
