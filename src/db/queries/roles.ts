import { eq, and } from "drizzle-orm"
import { db } from "@/db"
import { roleDefinitions, userRoles } from "@/db/schema"

export async function getUserRoles(userId: string) {
  return db.query.userRoles.findMany({
    where: and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)),
    with: { roleDefinition: true },
  })
}

export async function hasRole(userId: string, roleName: string) {
  const result = await db.query.userRoles.findFirst({
    where: and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)),
    with: {
      roleDefinition: {
        columns: { roleName: true },
      },
    },
  })
  return result?.roleDefinition?.roleName === roleName
}

export async function assignRole(
  userId: string,
  roleName: string,
  assignedBy?: string
) {
  const role = await db.query.roleDefinitions.findFirst({
    where: eq(roleDefinitions.roleName, roleName),
  })
  if (!role) throw new Error(`Role "${roleName}" not found`)

  const [result] = await db
    .insert(userRoles)
    .values({
      userId,
      roleDefinitionId: role.id,
      assignedBy: assignedBy ?? null,
    })
    .onConflictDoUpdate({
      target: [userRoles.userId, userRoles.roleDefinitionId],
      set: { isActive: true, updatedAt: new Date() },
    })
    .returning()
  return result
}

export async function revokeRole(userId: string, roleDefinitionId: string) {
  const [result] = await db
    .update(userRoles)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleDefinitionId, roleDefinitionId)
      )
    )
    .returning()
  return result
}

export async function getAllRoleDefinitions() {
  return db.query.roleDefinitions.findMany({
    where: eq(roleDefinitions.isActive, true),
    orderBy: (r, { desc }) => [desc(r.hierarchyLevel)],
  })
}
