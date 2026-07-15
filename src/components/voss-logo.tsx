import { cn } from "@/lib/utils"

// The VOSS lockup: heavy wordmark plus an orange square. Reproduced in type, not
// shipped as an image — one less asset, and it inherits the current text color.
// `product` names the app that sits under the VOSS umbrella (VERP, vboard...).
export function VossWordmark({
  product,
  className,
}: {
  product?: string
  className?: string
}) {
  return (
    <div className={cn("flex items-baseline gap-[5px]", className)}>
      <span className="text-lg leading-none font-black tracking-[-0.03em] select-none">
        VOSS
      </span>
      <span aria-hidden className="size-[7px] shrink-0 bg-[#FB7A3C]" />
      {product && (
        <span className="text-muted-foreground ml-1 text-sm font-medium">
          {product}
        </span>
      )}
    </div>
  )
}

// Compact mark for square tiles (the sidebar header). "V" plus the orange square.
export function VossMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center font-black select-none",
        className
      )}
    >
      V
      <span
        aria-hidden
        className="absolute right-[3px] bottom-[5px] size-[5px] bg-[#FB7A3C]"
      />
    </span>
  )
}
