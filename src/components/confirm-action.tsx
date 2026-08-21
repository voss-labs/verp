"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { ButtonVariants } from "@/components/ui/button-variants"

type ConfirmActionBase = {
  title: string
  description?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  disabled?: boolean
  onConfirm: () => void | Promise<void>
}

export type ConfirmActionProps = ConfirmActionBase &
  (
    | {
        trigger: React.ReactElement
        label?: never
        variant?: never
        size?: never
      }
    | {
        trigger?: never
        label: string
        variant?: ButtonVariants["variant"]
        size?: ButtonVariants["size"]
      }
  )

export function ConfirmAction({
  trigger,
  label,
  variant,
  size,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = true,
  disabled,
  onConfirm,
}: ConfirmActionProps) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  async function confirm() {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next)
      }}
    >
      {trigger ? (
        <AlertDialogTrigger disabled={disabled} render={trigger} />
      ) : (
        <AlertDialogTrigger
          disabled={disabled}
          render={
            <Button
              variant={variant ?? (destructive ? "destructive" : "default")}
              size={size ?? "default"}
            />
          }
        >
          {label}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={confirm}
          >
            {busy && (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            )}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
