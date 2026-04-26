import { BookOpen, Clock } from 'lucide-react'
import FocusCardAlmanac from './FocusCardAlmanac'
import FocusCardClassic from './FocusCardClassic'
import { useFocusCardVariant } from './useFocusCardVariant'
import { useI18n } from '../../shared/i18n/useI18n'

const FocusCard = () => {
  const [variant, setVariant] = useFocusCardVariant()
  const { t } = useI18n()
  const next = variant === 'classic' ? 'almanac' : 'classic'
  return (
    <div className="focus-card-shell">
      {variant === 'classic' ? <FocusCardClassic /> : <FocusCardAlmanac />}
      <button
        type="button"
        className="focus-card-shell__variant"
        onClick={() => setVariant(next)}
        aria-label={t('focus.switchVariant')}
        title={
          variant === 'classic' ? t('focus.variantAlmanac') : t('focus.variantClassic')
        }
      >
        {variant === 'classic' ? <BookOpen size={12} /> : <Clock size={12} />}
      </button>
    </div>
  )
}

export default FocusCard
