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
      // Bare `border` / `divide` classes get the themed hairline instead of
      // Tailwind's cool gray-200 (which glowed in dark mode).
      borderColor: {
        DEFAULT: 'hsl(var(--ui-border))',
      },
      // Tailwind transition utilities share the app motion tokens (tokens.css),
      // so they also honour the in-app "reduce motion" switch.
      transitionDuration: {
        DEFAULT: 'var(--motion-duration-fast)',
        75: 'var(--motion-duration-instant)',
        100: 'var(--motion-duration-instant)',
        150: 'var(--motion-duration-fast)',
        200: 'var(--motion-duration-base)',
        300: 'var(--motion-duration-medium)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease-standard)',
        standard: 'var(--ease-standard)',
        emphasized: 'var(--ease-emphasized)',
        sheet: 'var(--ease-sheet)',
      },
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
      // Paper & Ink tokens (apps/web/DESIGN.md). Prefer these over Tailwind's
      // stock palettes (rose/amber/teal/slate…) anywhere in app chrome.
      fontSize: {
        meta: ['var(--fs-meta)', { lineHeight: '1.4' }],
        label: ['var(--fs-label)', { lineHeight: '1.45' }],
        ui: ['var(--fs-ui)', { lineHeight: '1.5' }],
        body: ['var(--fs-body)', { lineHeight: '1.55' }],
        section: ['var(--fs-section)', { lineHeight: '1.45' }],
        subhead: ['var(--fs-subhead)', { lineHeight: '1.3' }],
        title: ['var(--fs-title)', { lineHeight: '1.08' }],
        hero: ['var(--fs-hero)', { lineHeight: '1.04' }],
        display: ['var(--fs-display)', { lineHeight: '1' }],
      },
      colors: {
        'ink-1': 'var(--ink-1)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        'ink-4': 'var(--ink-4)',
        'paper-desk': 'var(--paper-desk)',
        'paper-sheet': 'var(--paper-sheet)',
        'paper-raised': 'var(--paper-raised)',
        'paper-sunken': 'var(--paper-sunken)',
        rule: 'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        'tone-urgent': 'var(--tone-urgent)',
        'tone-warn': 'var(--tone-warn)',
        'tone-done': 'var(--tone-done)',
        'tone-info': 'var(--tone-info)',
        'tone-urgent-wash': 'var(--tone-urgent-wash)',
        'tone-warn-wash': 'var(--tone-warn-wash)',
        'tone-done-wash': 'var(--tone-done-wash)',
        'tone-info-wash': 'var(--tone-info-wash)',
        'accent-wash': 'var(--accent-wash)',
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
          DEFAULT: 'hsl(var(--ui-accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--ui-border))',
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
