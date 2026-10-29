"use client";

import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { api, isApiError, setCsrfToken } from "@/lib/api/client";
import type { LoginResponse, MfaSetupResponse } from "@/lib/api/types";
import { ME_KEY } from "@/hooks/use-me";
import { adminErrorText, TextInput } from "./ui";
import { media } from "@/lib/media";

function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="surface w-full max-w-[460px] rounded-[10px] p-6 sm:p-8">
        <Image src={media("logo.png")} alt="Vape Hub" width={190} height={40} className="mx-auto mb-24" />
        <h1 className="h5 mb-24 text-center text-white">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="form-alert is-error mb-16">
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
    <AuthCard title="Admin sign in">
      <form onSubmit={submit} className="space-y-4" data-testid="admin-login">
        <ErrorLine error={error} />
        <TextInput label="Email" type="email" value={email} onChange={setEmail} required testId="admin-email" />
        <TextInput label="Password" type="password" value={password} onChange={setPassword} required testId="admin-password" />
        <button type="submit" className="cus-btn is-filled w-full" disabled={pending} aria-busy={pending} data-testid="admin-login-submit">
          {pending ? <span className="spinner" aria-hidden /> : null}
          {pending ? "Signing in…" : "Sign in"}
        </button>
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
    <AuthCard title="Two-factor verification">
      <form onSubmit={submit} className="space-y-4" data-testid="mfa-verify">
        <p className="text-sm">
          {mode === "totp" ? "Enter the 6-digit code from your authenticator app." : "Enter one of your unused recovery codes. Each code works once."}
        </p>
        <ErrorLine error={error} />
        <TextInput
          label={mode === "totp" ? "Authentication code" : "Recovery code"}
          value={value}
          onChange={setValue}
          required
          testId="mfa-code"
          placeholder={mode === "totp" ? "123456" : "xxxx-xxxx-xx"}
        />
        <button type="submit" className="cus-btn is-filled w-full" disabled={pending} aria-busy={pending} data-testid="mfa-submit">
          {pending ? <span className="spinner" aria-hidden /> : <ShieldCheck className="!h-5 !w-5" aria-hidden />}
          Verify
        </button>
        <button type="button" className="text-link w-full text-center text-sm" onClick={() => setMode(mode === "totp" ? "recovery" : "totp")} data-testid="mfa-toggle">
          {mode === "totp" ? "Use a recovery code instead" : "Use an authenticator code"}
        </button>
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
      <AuthCard title="Save your recovery codes">
        <p className="mb-16 text-sm">
          Each code can be used once if you lose access to your authenticator. They will not be shown again — store them in a password manager.
        </p>
        <ul className="mb-24 grid grid-cols-2 gap-2 rounded-[5px] bg-black p-4 font-mono text-sm text-white" data-testid="recovery-codes">
          {recoveryCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button type="button" className="cus-btn is-filled w-full" onClick={() => void client.invalidateQueries({ queryKey: ME_KEY })} data-testid="recovery-saved">
          I have saved these codes
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set up two-factor authentication">
      <ErrorLine error={error} />
      {!setup ? (
        <>
          <p className="mb-24 text-sm">Administrator accounts must use an authenticator app (TOTP). Scan a QR code with Google Authenticator, 1Password, Authy or similar.</p>
          <button type="button" className="cus-btn is-filled w-full" onClick={start} disabled={pending} aria-busy={pending} data-testid="mfa-start">
            {pending ? <span className="spinner" aria-hidden /> : null}
            Generate QR code
          </button>
        </>
      ) : (
        <form onSubmit={activate} className="space-y-4" data-testid="mfa-enroll">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR code generated by the server */}
          <img src={setup.qrDataUrl} alt="QR code for your authenticator app" width={200} height={200} className="mx-auto rounded bg-white p-2" />
          <p className="break-all text-center text-xs">
            Manual key: <code className="text-white" data-testid="mfa-secret">{setup.secret}</code>
          </p>
          <TextInput label="Code from the app" value={code} onChange={setCode} required testId="mfa-enroll-code" placeholder="123456" />
          <button type="submit" className="cus-btn is-filled w-full" disabled={pending} aria-busy={pending} data-testid="mfa-activate">
            {pending ? <span className="spinner" aria-hidden /> : null}
            Activate
          </button>
        </form>
      )}
    </AuthCard>
  );
}
