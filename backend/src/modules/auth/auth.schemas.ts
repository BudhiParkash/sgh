import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^(\d{6}|[A-Za-z0-9]{5}-[A-Za-z0-9]{5})$/, "Enter the 6-digit code or a recovery code"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
});

export const disable2faSchema = z.object({ password: z.string().min(1).max(128), code: z.string().trim().regex(/^\d{6}$/) });
