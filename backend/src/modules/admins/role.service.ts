import { ROLES } from "@sgh/shared";
import { DEFAULT_ROLES } from "./permissions.js";
import { RoleModel } from "./role.model.js";

/** Idempotently creates/updates the six system roles with their default permissions. */
export async function ensureSystemRoles(): Promise<void> {
  for (const key of ROLES) {
    const def = DEFAULT_ROLES[key];
    const existing = await RoleModel.findOne({ key });
    if (!existing) {
      await RoleModel.create({ key, name: def.name, permissions: def.permissions, isSystem: true });
    } else if (existing.isSystem && JSON.stringify([...existing.permissions].sort()) !== JSON.stringify([...def.permissions].sort())) {
      existing.permissions = def.permissions;
      existing.version += 1;
      await existing.save();
    }
  }
}
