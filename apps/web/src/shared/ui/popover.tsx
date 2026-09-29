import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "../lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, style, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "popover-content fg-popover rounded-2xl",
        className
      )}
      {...props}
      // `style` is pulled out of props so a caller's style extends the surface
      // instead of replacing it (spreading props after this used to drop the
      // background, border and z-index whenever a caller passed any style).
      style={{
        zIndex: "var(--z-popover)",
        border: "1px solid var(--border)",
        backgroundColor: "var(--bg-elevated)",
        color: "var(--text-primary)",
        boxShadow: "var(--shadow-lift)",
        outline: "none",
        ...style
      }}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
