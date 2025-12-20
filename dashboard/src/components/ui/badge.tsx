import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        meta: "border-transparent bg-[var(--color-meta)]/10 text-[var(--color-meta)]",
        ga4: "border-transparent bg-[var(--color-ga4)]/10 text-[var(--color-ga4)]",
        shopify: "border-transparent bg-[var(--color-shopify)]/10 text-[var(--color-shopify)]",
        success: "border-transparent bg-[var(--color-success)]/10 text-[var(--color-success)]",
        warning: "border-transparent bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
        error: "border-transparent bg-[var(--color-error)]/10 text-[var(--color-error)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
