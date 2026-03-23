import { Button } from '@/components/ui/button'
import Dialog from '../../shared/ui/Dialog'
import { useI18n } from '../../shared/i18n/useI18n'

type OnboardingModalProps = {
  open: boolean
  onStart: () => void
  onSkip: () => void
}

const OnboardingModal = ({ open, onStart, onSkip }: OnboardingModalProps) => {
  const { t } = useI18n()

  return (
    <Dialog open={open} title="" onClose={onSkip} panelClassName="max-w-[420px] rounded-[30px] border border-[#3A3733]/8 bg-[#F5F3F0]">
      <div className="px-1 py-2 text-[#3A3733]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#3A3733]/56">{t('onboarding.welcome.eyebrow')}</p>
        <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.03em]">{t('onboarding.welcome.title')}</h2>
        <p className="mt-3 text-sm leading-6 text-[#3A3733]/72">{t('onboarding.welcome.description')}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" className="rounded-full border-[#3A3733]/12 text-[#3A3733]" onClick={onSkip}>
            {t('onboarding.welcome.skip')}
          </Button>
          <Button type="button" className="rounded-full bg-[#3A3733] text-[#F5F3F0] hover:bg-[#3A3733]/90" onClick={onStart}>
            {t('onboarding.welcome.start')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export default OnboardingModal
