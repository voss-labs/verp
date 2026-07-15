import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const roleDefinitions = pgTable("role_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleName: text("role_name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").notNull().default({}),
  hierarchyLevel: integer("hierarchy_level").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roleDefinitionId: uuid("role_definition_id")
      .notNull()
      .references(() => roleDefinitions.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by").references(() => user.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("user_roles_user_role_uniq").on(
      table.userId,
      table.roleDefinitionId
    ),
    index("user_roles_user_id_idx").on(table.userId),
    index("user_roles_role_definition_id_idx").on(table.roleDefinitionId),
    index("user_roles_is_active_idx").on(table.isActive),
  ]
)
