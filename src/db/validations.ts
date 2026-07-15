import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { students } from "./schema/students"
import { faculty } from "./schema/faculty"
import { departments } from "./schema/departments"
import { courses } from "./schema/courses"
import { marks } from "./schema/marks"

export const insertStudentSchema = createInsertSchema(students, {
  email: (schema) => schema.email("Invalid email format"),
  phoneNo: (schema) =>
    schema.regex(/^\d{10}$/, "Phone must be 10 digits").optional(),
  department: () => z.string().min(1, "Department is required"),
  division: () => z.enum(["A", "B"]).optional(),
  year: () => z.enum(["FE", "SE", "TE", "BE"]),
  gender: () => z.enum(["M", "F", "Other", "Prefer not to say"]).optional(),
})
export const updateStudentSchema = insertStudentSchema.partial()
export const selectStudentSchema = createSelectSchema(students)

export const insertFacultySchema = createInsertSchema(faculty, {
  email: (schema) => schema.email("Invalid email format"),
  phoneNo: (schema) =>
    schema.regex(/^\d{10}$/, "Phone must be 10 digits").optional(),
  department: () => z.string().min(1, "Department is required"),
})
export const updateFacultySchema = insertFacultySchema.partial()
export const selectFacultySchema = createSelectSchema(faculty)

export const insertDepartmentSchema = createInsertSchema(departments, {
  name: () => z.string().min(1, "Department name is required"),
  code: () => z.string().min(1, "Department code is required").toUpperCase(),
})
export const updateDepartmentSchema = insertDepartmentSchema.partial()

export const insertCourseSchema = createInsertSchema(courses, {
  courseName: () => z.string().min(1, "Course name is required"),
  courseCode: () => z.string().min(1, "Course code is required").toUpperCase(),
  courseType: () => z.enum(["theory", "practical", "project"]),
  credits: () => z.number().int().min(1).max(6),
  maxIsa: () => z.number().int().min(0),
  maxMse: () => z.number().int().min(0),
  maxEse: () => z.number().int().min(0),
  maxTotal: () => z.number().int().min(1),
})
export const updateCourseSchema = insertCourseSchema.partial()

export const insertMarksSchema = createInsertSchema(marks, {
  isa: () => z.number().int().min(0).optional(),
  mse1: () => z.number().int().min(0).optional(),
  mse2: () => z.number().int().min(0).optional(),
  ese: () => z.number().int().min(0).optional(),
})
export const updateMarksSchema = insertMarksSchema.partial()
