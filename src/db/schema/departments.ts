import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core"

// The 5 branches. The branch CODE is the primary key (IT, CMPN, EXTC, BIOMED,
// EXCS) so every scope path keys on a stable, human-readable value — never a
// surrogate int that means nothing in a roll number.
export const departments = pgTable(
  "departments",
  {
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    // Denormalised pointer to the current HOD (the authoritative record is
    // dept_appointments). Nullable — a dept can exist before an HOD is named.
    hodFacultyId: text("hod_faculty_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("departments_is_active_idx").on(t.isActive)]
)
