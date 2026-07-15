import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"

export const dynamic = "force-dynamic"

// Client-safe view of the session. capabilities is serialized as an array (a Set
// does not survive JSON); the sidebar only needs tier + scope to route.
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    tier: user.tier,
    facultyId: user.facultyId,
    studentId: user.studentId,
    deptCodes: user.deptCodes,
    classIds: user.classIds,
    capabilities: [...user.capabilities],
  })
}
