import type { Config } from 'tailwindcss'
import fluid, { extract } from 'fluid-tailwind'
import tailwindcssAnimate from 'tailwindcss-animate'

const FLUID_MIN_SCREEN_REM = 20
const FLUID_MAX_SCREEN_REM = 90

function clampRem(minRem: number, maxRem: number) {
  if (minRem === maxRem) return `${minRem}rem`
  const slope = (maxRem - minRem) / (FLUID_MAX_SCREEN_REM - FLUID_MIN_SCREEN_REM)
  const yAxisIntersection = -FLUID_MIN_SCREEN_REM * slope + minRem
  const vwPart = `${(slope * 100).toFixed(6)}vw`
  const remPart = `${yAxisIntersection.toFixed(6)}rem`
  return `clamp(${minRem}rem, calc(${remPart} + ${vwPart}), ${maxRem}rem)`
}

const fluidRadius = {
  none: '0px',
  sm: clampRem(0.125, 0.375),
  DEFAULT: clampRem(0.25, 0.5),
  md: clampRem(0.375, 0.5),
  lg: clampRem(0.5, 0.75),
  xl: clampRem(0.75, 1.0),
  '2xl': clampRem(1.0, 1.5),
  '3xl': '1.5rem',
  full: '9999px',
} as const

const config = {
  darkMode: ['class'],
  content: {
    files: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    extract,
  },
  theme: {
    borderRadius: {
      ...fluidRadius,
      fluid: fluidRadius.DEFAULT,
      'fluid-sm': fluidRadius.sm,
      'fluid-md': fluidRadius.md,
      'fluid-lg': fluidRadius.lg,
      'fluid-xl': fluidRadius.xl,
      'fluid-2xl': fluidRadius['2xl'],
      'fluid-3xl': fluidRadius['3xl'],
    },
    extend: {
      spacing: {
        page: 'var(--page-pad)',
        route: 'var(--route-pad)',
        panel: 'var(--panel-gap)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        shell: 'var(--surface-radius-lg)',
        panel: 'var(--surface-radius-md)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
    },
  },
  plugins: [fluid, tailwindcssAnimate],
} satisfies Config

export default config
