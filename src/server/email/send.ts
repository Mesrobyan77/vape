import nodemailer, { type Transporter } from "nodemailer";
import type { Locale } from "@/lib/api/types";
import { config } from "../config";
import { CapturedEmail } from "../models";
import { enqueue } from "../services/outbox";
import { renderEmail, type EmailData, type EmailTemplate } from "./templates";
import type { ClientSession } from "mongoose";

let transporter: Transporter | null = null;

function smtp(): Transporter | null {
  const cfg = config();
  if (!cfg.smtp) return null;
  transporter ??= nodemailer.createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined,
  });
  return transporter;
}

export interface EmailJob {
  to: string;
  template: EmailTemplate;
  locale: Locale;
  data: Omit<EmailData, "siteUrl">;
}

/** Delivers one email. Without SMTP outside production, mail is captured in the DB (dev/test inbox). */
export async function deliverEmail(job: EmailJob): Promise<void> {
  const cfg = config();
  const rendered = renderEmail(job.template, job.locale, { ...job.data, siteUrl: cfg.siteUrl });
  const transport = smtp();
  if (transport) {
    await transport.sendMail({ from: cfg.mailFrom, to: job.to, subject: rendered.subject, text: rendered.text, html: rendered.html });
    return;
  }
  if (cfg.isProduction) throw new Error("SMTP is not configured");
  await CapturedEmail.create({ to: job.to, subject: rendered.subject, text: rendered.text, html: rendered.html, template: job.template });
}

/** Queues an email through the outbox (exactly once per dedupeKey). */
export async function queueEmail(job: EmailJob, dedupeKey: string, session?: ClientSession): Promise<void> {
  await enqueue([{ type: "email", dedupeKey: `email:${dedupeKey}`, payload: job as unknown as Record<string, unknown> }], session);
}
