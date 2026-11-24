import { hash, verify, type Algorithm } from "@node-rs/argon2";

/** OWASP-recommended Argon2id minimums (m=19 MiB, t=2, p=1). */
// Algorithm.Argon2id === 2 (const enum; inlined because isolatedModules forbids ambient const enums)
const OPTIONS = { algorithm: 2 as Algorithm, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (plain: string) => hash(plain, OPTIONS);

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

/** Pre-computed hash used to keep login timing equal when the email doesn't exist. */
let dummy: string | undefined;
export async function dummyVerify(plain: string): Promise<void> {
  dummy ??= await hashPassword("timing-equalisation-dummy-password");
  await verifyPassword(dummy, plain);
}

/** Small local list of the most common passwords; full breach checks (HIBP k-anonymity) can be added later. */
const COMMON = new Set([
  "password", "password1", "password123", "123456789012", "qwertyuiop12", "iloveyou1234", "admin1234567",
  "welcome12345", "letmein12345", "shivanshigaming", "bgmi12345678", "pubgmobile123",
]);

export function passwordPolicyError(pw: string, email?: string): string | null {
  if (pw.length < 12) return "Password must be at least 12 characters.";
  if (pw.length > 128) return "Password must be at most 128 characters.";
  if (COMMON.has(pw.toLowerCase())) return "This password is too common.";
  if (email && pw.toLowerCase().includes(email.split("@")[0]!.toLowerCase())) return "Password must not contain your email name.";
  return null;
}
