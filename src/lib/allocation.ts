// Who may act on a subject.
//
// Extracted from the class actions so the rule has one statement and can be
// tested. It was previously inlined, and drifted: marks entry and locking
// enforced it while the three batch actions did not, so a teacher could
// restructure the lab groups of a subject they do not teach.

export type AllocationActor = {
  tier: "super_admin" | "hod" | "faculty" | "student" | null
  facultyId: string | null
  deptCodes: string[]
  coordinatorClassIds: string[]
}

/**
 * Allocating subjects is the coordinator's job, plus the HOD above them. A
 * plain TR is excluded: they teach what they are given, and letting them mint
 * subjects is how one course lands on a class twice under two spellings.
 */
export function canAllocate(
  user: AllocationActor,
  classId: string,
  deptCode: string
): boolean {
  return (
    user.tier === "super_admin" ||
    (user.tier === "hod" && user.deptCodes.includes(deptCode)) ||
    user.coordinatorClassIds.includes(classId)
  )
}

/**
 * Writing to a subject — its marks, its locks, its lab batches — belongs to the
 * teacher it was allocated to, or to anyone senior enough to cover for them.
 * An unallocated subject falls to the coordinator rather than to whoever
 * happens to open it first.
 */
export function canWriteOffering(
  user: AllocationActor,
  offeringFacultyId: string | null,
  classId: string,
  deptCode: string
): boolean {
  if (canAllocate(user, classId, deptCode)) return true
  return offeringFacultyId != null && offeringFacultyId === user.facultyId
}

/**
 * Who may reopen a frozen marks component.
 *
 * The coordinator, the HOD and super_admin can, because reopening undoes a
 * submission somebody else may already have acted on.
 *
 * So can whoever locked it. Freezing your own marks and then needing another
 * person to undo it is friction with no safeguard behind it — correcting your
 * own submission is not overriding anyone else's. What the rule protects
 * against is teacher A reopening teacher B's work, and that still cannot happen.
 */
export function canReopenLock(
  user: AllocationActor,
  classId: string,
  deptCode: string,
  lockedByFacultyId: string | null
): boolean {
  if (canAllocate(user, classId, deptCode)) return true
  return lockedByFacultyId != null && lockedByFacultyId === user.facultyId
}

export type ClassTeacher = {
  facultyId: string
  name: string
  role: string | null
}

export function classTeacherOptions(
  staff: { facultyId: string; name: string; role: string }[],
  allocated: { facultyId: string; name: string }[]
): ClassTeacher[] {
  const byId = new Map<string, ClassTeacher>()
  for (const s of staff) {
    byId.set(s.facultyId, {
      facultyId: s.facultyId,
      name: s.name,
      role: s.role,
    })
  }
  for (const a of allocated) {
    if (byId.has(a.facultyId)) continue
    byId.set(a.facultyId, { facultyId: a.facultyId, name: a.name, role: null })
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function countClassTeachers(
  staff: { facultyId: string; role: string }[],
  allocatedFacultyIds: (string | null | undefined)[]
): number {
  const ids = new Set<string>()
  for (const s of staff) if (s.role === "tr") ids.add(s.facultyId)
  for (const id of allocatedFacultyIds) if (id) ids.add(id)
  return ids.size
}

/**
 * Whether a department is the caller's to act in.
 *
 * The simplest of these rules, and the one that was missing where it mattered
 * most. The department workspace applied it to everything; the administration
 * console applied it to nothing — and two of that console's capabilities,
 * faculty:create and faculty:update, are HOD defaults. An HOD could therefore
 * add staff to a department that was not theirs, and deactivate anyone in the
 * college, including another department's HOD.
 *
 * Stated here rather than in either file so there is one definition to reason
 * about, the way canAllocate already is.
 */
export function inDeptScope(
  user: Pick<AllocationActor, "tier" | "deptCodes">,
  deptCode: string
): boolean {
  return user.tier === "super_admin" || user.deptCodes.includes(deptCode)
}
