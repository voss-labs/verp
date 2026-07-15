import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { students } from "./schema/students"
import { faculty } from "./schema/faculty"

export const insertStudentSchema = createInsertSchema(students, {
  email: (schema) => schema.email("Invalid email format").optional(),
  department: () => z.string().min(1, "Department is required"),
  division: () => z.enum(["A", "B", "C"]).optional(),
  year: () => z.enum(["FE", "SE", "TE", "BE"]),
})
export const updateStudentSchema = insertStudentSchema.partial()
export const selectStudentSchema = createSelectSchema(students)

export const insertFacultySchema = createInsertSchema(faculty, {
  email: (schema) => schema.email("Invalid email format"),
  department: () => z.string().min(1, "Department is required"),
})
export const updateFacultySchema = insertFacultySchema.partial()
export const selectFacultySchema = createSelectSchema(faculty)
