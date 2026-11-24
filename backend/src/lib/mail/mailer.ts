import nodemailer, { type Transporter } from "nodemailer";
import { env, isTest } from "../../config/env.js";
import { logger } from "../../config/logger.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Emails sent in tests (no network). */
export const sentMail: Mail[] = [];
let transport: Transporter | null = null;

/**
 * Sends a plain-text email via SMTP (Amazon SES SMTP in production). Without SMTP_URL (development)
 * the email is logged instead. Never throws into the request: failures are logged.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (isTest) {
    sentMail.push(mail);
    return;
  }
  if (!env.SMTP_URL) {
    logger.info({ to: mail.to.replace(/(.{2}).*@/, "$1***@"), subject: mail.subject }, "Email (not sent — SMTP_URL not configured)");
    return;
  }
  try {
    transport ??= nodemailer.createTransport(env.SMTP_URL);
    await transport.sendMail({ from: env.MAIL_FROM, ...mail });
  } catch (err) {
    logger.error({ err, subject: mail.subject }, "Email failed");
  }
}
