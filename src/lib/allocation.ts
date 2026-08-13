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
