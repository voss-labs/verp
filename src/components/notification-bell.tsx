"use client"

import { useCallback, useEffect, useState } from "react"
import { BellIcon, CheckCheckIcon } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Item = {
  id: string
  title: string
  message: string
  type: "info" | "warning" | "action"
  read: boolean
  createdAt: string
}

export function NotificationBell({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<Item[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" })
      if (!response.ok) return
      const { data } = await response.json()
      setItems(data.items)
      setUnread(data.unreadCount)
    } catch {
      // Keep the header usable when notifications are temporarily unavailable.
    }
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(refresh, 60_000)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(timer)
    }
  }, [refresh])

  async function markRead(id: string) {
    const response = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
    })
    if (response.ok) {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item))
      )
      setUnread((current) => Math.max(0, current - 1))
    }
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications/mark-all-read", {
      method: "POST",
    })
    if (response.ok) {
      setItems((current) => current.map((item) => ({ ...item, read: true })))
      setUnread(0)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void refresh()
      }}
    >
      <PopoverTrigger
        type="button"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className={`text-muted-foreground hover:bg-muted relative inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${className}`}
      >
        <BellIcon className="size-4" />
        {unread > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 min-w-4 rounded-full px-1 text-[10px] leading-4">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-medium">Notifications</span>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unread === 0}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs disabled:opacity-50"
          >
            <CheckCheckIcon className="size-3.5" /> Mark all read
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              You?re all caught up.
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => !item.read && void markRead(item.id)}
                className={`hover:bg-muted block w-full border-b px-3 py-2 text-left last:border-0 ${item.read ? "opacity-70" : ""}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`size-2 shrink-0 rounded-full ${item.read ? "bg-muted" : item.type === "warning" ? "bg-amber-500" : "bg-primary"}`}
                  />
                  <span className="font-medium">{item.title}</span>
                </span>
                <span className="text-muted-foreground mt-1 block pl-4 text-xs">
                  {item.message}
                </span>
                <time className="text-muted-foreground mt-1 block pl-4 text-[10px]">
                  {new Date(item.createdAt).toLocaleString()}
                </time>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
