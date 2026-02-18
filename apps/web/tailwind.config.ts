import type { Config } from "tailwindcss"
import fluid, { extract } from "fluid-tailwind"

const FLUID_MIN_SCREEN_REM = 20 // 320px @ 16px/rem
const FLUID_MAX_SCREEN_REM = 90 // 1440px @ 16px/rem

function clampRem(minRem: number, maxRem: number) {
  if (minRem === maxRem) return `${minRem}rem`
  const slope = (maxRem - minRem) / (FLUID_MAX_SCREEN_REM - FLUID_MIN_SCREEN_REM)
  const yAxisIntersection = -FLUID_MIN_SCREEN_REM * slope + minRem
  const vwPart = `${(slope * 100).toFixed(6)}vw`
  const remPart = `${yAxisIntersection.toFixed(6)}rem`
  return `clamp(${minRem}rem, calc(${remPart} + ${vwPart}), ${maxRem}rem)`
}

const fluidRadius = {
  none: "0px",
  sm: clampRem(0.125, 0.375), // sm -> md
  DEFAULT: clampRem(0.25, 0.5), // DEFAULT -> lg
  md: clampRem(0.375, 0.5), // md -> lg
  lg: clampRem(0.5, 0.75), // lg -> xl
  xl: clampRem(0.75, 1.0), // xl -> 2xl
  "2xl": clampRem(1.0, 1.5), // 2xl -> 3xl
  "3xl": "1.5rem", // fixed
  full: "9999px",
} as const

const config = {
  content: {
    files: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    extract,
  },
  theme: {
    borderRadius: {
      ...fluidRadius,
      fluid: fluidRadius.DEFAULT,
      "fluid-sm": fluidRadius.sm,
      "fluid-md": fluidRadius.md,
      "fluid-lg": fluidRadius.lg,
      "fluid-xl": fluidRadius.xl,
      "fluid-2xl": fluidRadius["2xl"],
      "fluid-3xl": fluidRadius["3xl"],
    },
    extend: {},
  },
  plugins: [fluid],
} satisfies Config

export default config

