"use client"

import { useEffect, useSyncExternalStore } from "react"

export type Tier = "super_admin" | "hod" | "faculty" | "student"

type UserRoleData = {
  tier: Tier | null
  facultyId: string | null
  studentId: string | null
  loading: boolean
}

let cachedData: UserRoleData = {
  tier: null,
  facultyId: null,
  studentId: null,
  loading: true,
}
let listeners: (() => void)[] = []

function subscribe(listener: () => void) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot() {
  return cachedData
}

let fetched = false

function fetchRole() {
  if (fetched) return
  fetched = true
  fetch("/api/me")
    .then((res) => {
      if (!res.ok) throw new Error("Unauthorized")
      return res.json()
    })
    .then((user) => {
      cachedData = {
        tier: user.tier ?? null,
        facultyId: user.facultyId,
        studentId: user.studentId,
        loading: false,
      }
      listeners.forEach((l) => l())
    })
    .catch(() => {
      cachedData = { ...cachedData, loading: false }
      listeners.forEach((l) => l())
    })
}

export function useUserRole(): UserRoleData {
  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    fetchRole()
  }, [])

  return data
}
