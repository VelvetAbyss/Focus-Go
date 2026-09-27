import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The Paper & Ink type scale and pill radius (tailwind.config.ts). Unregistered, twMerge
// reads `text-meta` as a text *color* and silently drops a real one like `text-primary-foreground`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["meta", "label", "ui", "body", "section", "subhead", "title", "hero", "display"],
      radius: ["pill"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
