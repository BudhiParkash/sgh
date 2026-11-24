/**
 * Creates the first Super Admin.
 *   pnpm --filter @sgh/backend create-super-admin -- --email you@example.com --name "Your Name"
 * Password: taken from SGH_ADMIN_PASSWORD if set, otherwise a strong random one is generated and printed ONCE.
 * The account must enable 2FA on first sign-in (role policy).
 */
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { env } from "../src/config/env.js";
import { connectDb, disconnectDb, syncIndexes } from "../src/config/db.js";
import { hashPassword, passwordPolicyError } from "../src/lib/password.js";
import { AdminModel } from "../src/modules/admins/admin.model.js";
import { RoleModel } from "../src/modules/admins/role.model.js";
import { ensureSystemRoles } from "../src/modules/admins/role.service.js";

const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
if (!values.email || !values.name) {
  console.error('Usage: create-super-admin --email <email> --name "<name>"');
  process.exit(1);
}
await connectDb(env.MONGODB_URI);
await syncIndexes();
await ensureSystemRoles();
const role = await RoleModel.findOne({ key: "super_admin" });
const generated = !process.env.SGH_ADMIN_PASSWORD;
const password = process.env.SGH_ADMIN_PASSWORD ?? randomBytes(18).toString("base64url");
const policy = passwordPolicyError(password, values.email);
if (policy) {
  console.error(policy);
  process.exit(1);
}
const email = values.email.toLowerCase();
if (await AdminModel.exists({ email })) {
  console.error(`An admin with email ${email} already exists.`);
  process.exit(1);
}
await AdminModel.create({ name: values.name, email, passwordHash: await hashPassword(password), role: role!._id, status: "active" });
console.log(`Super Admin created: ${email}`);
if (generated) console.log(`Temporary password (shown once — change it after first sign-in): ${password}`);
await disconnectDb();
