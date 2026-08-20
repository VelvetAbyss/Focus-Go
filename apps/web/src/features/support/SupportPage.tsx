import { Heart, ExternalLink } from 'lucide-react'

type SupportLink = { label: string; href: string }

const links = (): SupportLink[] => [
  ['GitHub Sponsors', import.meta.env.VITE_SUPPORT_GITHUB_URL],
  ['PayPal', import.meta.env.VITE_SUPPORT_PAYPAL_URL],
  ['Z-Pay', import.meta.env.VITE_SUPPORT_ZPAY_URL],
].flatMap(([label, href]) => typeof href === 'string' && href.trim() ? [{ label, href }] : [])

const SupportPage = () => {
  const destinations = links()
  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 py-10 text-[var(--text-primary)]">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]"><Heart size={16} /> Support Focus&go</div>
        <h1 className="text-3xl font-semibold tracking-tight">Focus&go is free for everyone.</h1>
        <p className="max-w-xl text-sm leading-6 text-[var(--text-secondary)]">Optional sponsorship helps cover the hosted sync service. It never unlocks features or changes your account.</p>
      </div>
      {destinations.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {destinations.map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] px-4 py-3 text-sm font-medium hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)]">
              {label}<ExternalLink size={15} />
            </a>
          ))}
        </div>
      ) : <p className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--text-primary)_18%,transparent)] p-4 text-sm text-[var(--text-secondary)]">Sponsorship links will appear here when they are configured.</p>}
    </main>
  )
}

export default SupportPage
