// The people the local development database contains.
//
// One definition, read by both the seeder that creates these rows and the
// switcher that lets you become them. They are the same list on purpose: a
// persona the switcher offers but the seed never created is a dead menu entry,
// and that is exactly the drift a second list produces.
//
// Chosen to make the authorization rules visible rather than to look like a
// real college. Two departments so cross-department isolation can be seen
// failing; two teachers on one class so "that subject is allocated to another
// teacher" can be reached; a coordinator distinct from the teachers so the
// decisions that belong to the coordinator can be told apart from the ones that
// do not.

export type DevPersona = {
  /** Cookie value, and the switcher's stable key. */
  key: string
  /** Resolved to a real `user` row, which is where the impersonation ends. */
  email: string
  name: string
  /** What this person is, in the college's words. */
  role: string
  /** The scope that makes them interesting to test. */
  scope: string
}

export const DEV_CLASS_A = "2023-108-A"
export const DEV_CLASS_B = "2023-108-B"
export const DEV_CLASS_EXTC = "2024-104-A"

export const DEV_PERSONAS: DevPersona[] = [
  {
    key: "admin",
    email: "dev.admin@vit.edu.in",
    name: "Asha Deshpande",
    role: "Super-admin",
    scope: "The whole institution",
  },
  {
    key: "hod-excs",
    email: "dev.hod.excs@vit.edu.in",
    name: "Ravi Kulkarni",
    role: "HOD",
    scope: "EXCS — two classes, cover authority",
  },
  {
    key: "hod-extc",
    email: "dev.hod.extc@vit.edu.in",
    name: "Sunita Rane",
    role: "HOD",
    scope: "EXTC — nothing in EXCS is visible",
  },
  {
    key: "coordinator",
    email: "dev.coordinator@vit.edu.in",
    name: "Priya Nair",
    role: "Coordinator",
    scope: "BE EXCS A — publishes, decides enrolment",
  },
  {
    key: "teacher-dav",
    email: "dev.teacher.dav@vit.edu.in",
    name: "Mandar Patil",
    role: "Teacher",
    scope: "BE EXCS A — Data Analytics only",
  },
  {
    key: "teacher-cn",
    email: "dev.teacher.cn@vit.edu.in",
    name: "Kavita Joshi",
    role: "Teacher",
    scope: "BE EXCS A — Computer Networks only",
  },
  {
    key: "teacher-b",
    email: "dev.teacher.b@vit.edu.in",
    name: "Imran Shaikh",
    role: "Teacher",
    scope: "BE EXCS B — a different division",
  },
  {
    key: "student",
    email: "dev.student@vit.edu.in",
    name: "Neha Bhosale",
    role: "Student",
    scope: "23108A0001 — has published results",
  },
  {
    key: "student-fresh",
    email: "dev.student.fresh@vit.edu.in",
    name: "Omkar Sawant",
    role: "Student",
    scope: "23108A0002 — nothing published yet",
  },
  {
    // Signed in, on no roster: the pending screen, which is easy to forget
    // exists and easy to break.
    key: "unbound",
    email: "dev.unbound@vit.edu.in",
    name: "Rohit Gaikwad",
    role: "Unplaced",
    scope: "Authenticated but on no roster",
  },
]

export function findPersona(key: string | undefined): DevPersona | null {
  if (!key) return null
  return DEV_PERSONAS.find((p) => p.key === key) ?? null
}
