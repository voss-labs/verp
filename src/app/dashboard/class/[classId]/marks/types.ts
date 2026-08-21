import type { CourseInfo } from "@/lib/sgpi"
import type { LockComponent } from "./lock-panel"

export type Offering = {
  id: string
  code: string
  name: string
  semester: number
  facultyId: string | null
  facultyName: string | null
}

export type Row = {
  studentId: string
  name: string
  rollNumber: string
  isa: number | null
  mse1: number | null
  mse2: number | null
  ese: number | null
}

/** A frozen component, and whether this viewer may reopen it. */
export type Lock = { component: LockComponent; canUnlock: boolean }

export type Grid = {
  offeringId: string
  published: boolean
  canPublish: boolean
  course: CourseInfo
  rows: Row[]
  locked: Lock[]
}
