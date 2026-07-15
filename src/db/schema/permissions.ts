import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { user } from "./auth"
import { overrideSubjectEnum, overrideEffectEnum } from "./enums"

// The super-admin's toggle layer over the fixed, code-defined capabilities.
// subjectId is polymorphic (a role name like "hod", or a user.id) so overrides
// can target a whole tier or one person. Resolution: super_admin is exempt (no
// row can lock the door-holder out); otherwise effectiveCaps = defaults, then
// role grants/denies, then user grants/denies. One live row per (subject, cap).
export const permissionOverrides = pgTable(
  "permission_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectType: overrideSubjectEnum("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    capability: text("capability").notNull(),
    effect: overrideEffectEnum("effect").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("override_live_uniq")
      .on(t.subjectType, t.subjectId, t.capability)
      .where(sql`is_active`),
  ]
)
