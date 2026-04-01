import { Fragment, useState } from 'react'
import { Check, X, Lock, Sparkles, Globe } from 'lucide-react'
import './UpgradeModal.css'
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from '../../../components/ui/dialog'
import { useUpgradeModal } from '../UpgradeModalContext'
import { useUpgradeModalI18n, PRICING, type PricingRegion } from '../upgradeModalI18n'

// ─── Cell renderer ──────────────────────────────────────────────────────────

const TableCell = ({ value }: { value: 'check' | 'cross' | string }) => {
  if (value === 'check') {
    return (
      <span className="upgrade-modal__table-check" aria-label="Included">
        <Check size={14} strokeWidth={2.5} />
      </span>
    )
  }
  if (value === 'cross') {
    return (
      <span className="upgrade-modal__table-cross" aria-label="Not included">
        <X size={13} strokeWidth={2} />
      </span>
    )
  }
  return <span className="upgrade-modal__table-text">{value}</span>
}

// ─── Main modal ─────────────────────────────────────────────────────────────

const UpgradeModal = () => {
  const { open, lockedFeature, closeModal } = useUpgradeModal()
  const i18n = useUpgradeModalI18n()
  const [region, setRegion] = useState<PricingRegion>('cn')
  const pricing = PRICING[region]

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) closeModal() }}>
      <DialogContent className="upgrade-modal__content" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{i18n.title}</DialogTitle>
        {/* Close button */}
        <DialogClose className="upgrade-modal__close" aria-label="Close">
          <X size={16} strokeWidth={2} />
        </DialogClose>

        {/* Locked feature context banner */}
        {lockedFeature && (
          <div className="upgrade-modal__locked-banner">
            <Lock size={13} strokeWidth={2} />
            <span>{i18n.lockedFeaturePrefix} <strong>{lockedFeature}</strong></span>
          </div>
        )}

        {/* ── Header ── */}
        <div className="upgrade-modal__header">
          <div className="upgrade-modal__header-text">
            <h2 className="upgrade-modal__title">{i18n.title}</h2>
            <p className="upgrade-modal__subtitle">{i18n.subtitle}</p>
          </div>

          {/* Region toggle */}
          <div className="upgrade-modal__region-toggle" role="group" aria-label="Pricing region">
            <button
              type="button"
              className={`upgrade-modal__region-btn${region === 'cn' ? ' is-active' : ''}`}
              onClick={() => setRegion('cn')}
            >
              {i18n.regionCN}
            </button>
            <button
              type="button"
              className={`upgrade-modal__region-btn${region === 'global' ? ' is-active' : ''}`}
              onClick={() => setRegion('global')}
            >
              <Globe size={12} strokeWidth={2} aria-hidden="true" />
              {i18n.regionGlobal}
            </button>
          </div>
        </div>

        {/* ── Plan cards ── */}
        <div className="upgrade-modal__cards">

          {/* Free */}
          <div className="upgrade-modal__card upgrade-modal__card--free">
            <div className="upgrade-modal__card-top">
              <span className="upgrade-modal__plan-name">{i18n.planFree}</span>
              <div className="upgrade-modal__price-row">
                <span className="upgrade-modal__price">{pricing.free}</span>
              </div>
              <p className="upgrade-modal__plan-tagline">{i18n.freeTagline}</p>
            </div>
            <ul className="upgrade-modal__perks">
              {i18n.freePerks.map((perk) => (
                <li key={perk} className="upgrade-modal__perk">
                  <Check size={13} strokeWidth={2.5} className="upgrade-modal__perk-icon" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <div className="upgrade-modal__card-foot">
              <button
                type="button"
                className="upgrade-modal__cta upgrade-modal__cta--secondary"
                onClick={closeModal}
              >
                {i18n.freeCta}
              </button>
            </div>
          </div>

          {/* Premium (featured) */}
          <div className="upgrade-modal__card upgrade-modal__card--premium">
            <div className="upgrade-modal__badge upgrade-modal__badge--recommended">
              <Sparkles size={11} strokeWidth={2} aria-hidden="true" />
              {i18n.badgeRecommended}
            </div>
            <div className="upgrade-modal__card-top">
              <span className="upgrade-modal__plan-name">{i18n.planPremium}</span>
              <div className="upgrade-modal__price-block">
                <div className="upgrade-modal__price-row">
                  <span className="upgrade-modal__price">{pricing.premiumMonthly}</span>
                  <span className="upgrade-modal__billing">{pricing.premiumMonthlyBilling}</span>
                </div>
                <div className="upgrade-modal__price-row upgrade-modal__price-row--secondary">
                  <span className="upgrade-modal__price upgrade-modal__price--sm">{pricing.premiumYearly}</span>
                  <span className="upgrade-modal__billing">{pricing.premiumYearlyBilling}</span>
                </div>
              </div>
              <p className="upgrade-modal__plan-tagline">{i18n.premiumTagline}</p>
            </div>
            <ul className="upgrade-modal__perks">
              {i18n.premiumPerks.map((perk) => (
                <li key={perk} className="upgrade-modal__perk">
                  <Check size={13} strokeWidth={2.5} className="upgrade-modal__perk-icon upgrade-modal__perk-icon--accent" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <div className="upgrade-modal__card-foot upgrade-modal__card-foot--premium">
              <button
                type="button"
                className="upgrade-modal__cta upgrade-modal__cta--primary"
                onClick={() => { /* TODO: wire payment */ }}
              >
                {i18n.premiumCtaMonthly}
              </button>
              <button
                type="button"
                className="upgrade-modal__cta upgrade-modal__cta--primary-outline"
                onClick={() => { /* TODO: wire payment */ }}
              >
                {i18n.premiumCtaYearly}
              </button>
            </div>
          </div>

          {/* Lifetime */}
          <div className="upgrade-modal__card upgrade-modal__card--lifetime">
            <div className="upgrade-modal__badge upgrade-modal__badge--one-time">
              {i18n.badgeOneTime}
            </div>
            <div className="upgrade-modal__card-top">
              <span className="upgrade-modal__plan-name">{i18n.planLifetime}</span>
              <div className="upgrade-modal__price-row">
                <span className="upgrade-modal__price">{pricing.lifetime}</span>
                <span className="upgrade-modal__billing">{pricing.lifetimeBilling}</span>
              </div>
              <p className="upgrade-modal__plan-tagline">{i18n.lifetimeTagline}</p>
            </div>
            <ul className="upgrade-modal__perks">
              {i18n.lifetimePerks.map((perk) => (
                <li key={perk} className="upgrade-modal__perk">
                  <Check size={13} strokeWidth={2.5} className="upgrade-modal__perk-icon" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <div className="upgrade-modal__card-foot">
              <button
                type="button"
                className="upgrade-modal__cta upgrade-modal__cta--secondary"
                onClick={() => { /* TODO: wire payment */ }}
              >
                {i18n.lifetimeCta}
              </button>
            </div>
          </div>
        </div>

        {/* ── Feature comparison table ── */}
        <div className="upgrade-modal__table-wrap">
          <p className="upgrade-modal__table-title">{i18n.comparisonTitle}</p>
          <table className="upgrade-modal__table" aria-label={i18n.comparisonTitle}>
            <thead>
              <tr>
                <th className="upgrade-modal__th upgrade-modal__th--feature" />
                <th className="upgrade-modal__th">{i18n.planFree}</th>
                <th className="upgrade-modal__th upgrade-modal__th--premium">{i18n.planPremium}</th>
                <th className="upgrade-modal__th">{i18n.planLifetime}</th>
              </tr>
            </thead>
            <tbody>
              {i18n.table.groups.map((group) => (
                <Fragment key={group.label}>
                  <tr className="upgrade-modal__table-group-row">
                    <td className="upgrade-modal__td upgrade-modal__td--group" colSpan={4}>
                      {group.label}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} className="upgrade-modal__table-row">
                      <td className="upgrade-modal__td upgrade-modal__td--label">{row.label}</td>
                      <td className="upgrade-modal__td upgrade-modal__td--cell">
                        <TableCell value={row.free} />
                      </td>
                      <td className="upgrade-modal__td upgrade-modal__td--cell upgrade-modal__td--premium-col">
                        <TableCell value={row.premium} />
                      </td>
                      <td className="upgrade-modal__td upgrade-modal__td--cell">
                        <TableCell value={row.lifetime} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer links ── */}
        <div className="upgrade-modal__footer">
          <button type="button" className="upgrade-modal__footer-link" onClick={() => { /* TODO */ }}>
            {i18n.footerRestore}
          </button>
          <span className="upgrade-modal__footer-sep" aria-hidden="true">·</span>
          <button type="button" className="upgrade-modal__footer-link" onClick={() => { /* TODO */ }}>
            {i18n.footerPromo}
          </button>
          <span className="upgrade-modal__footer-sep" aria-hidden="true">·</span>
          <button type="button" className="upgrade-modal__footer-link" onClick={() => { /* TODO */ }}>
            {i18n.footerFaq}
          </button>
          <span className="upgrade-modal__footer-sep" aria-hidden="true">·</span>
          <button type="button" className="upgrade-modal__footer-link" onClick={() => { /* TODO */ }}>
            {i18n.footerTerms}
          </button>
          <span className="upgrade-modal__footer-sep" aria-hidden="true">·</span>
          <button type="button" className="upgrade-modal__footer-link" onClick={() => { /* TODO */ }}>
            {i18n.footerContact}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default UpgradeModal
