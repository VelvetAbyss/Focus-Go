import ModulePlaceholder from '../../../shared/ui/ModulePlaceholder'
import { useI18n } from '../../../shared/i18n/useI18n'

const RssPage = () => {
  const { t } = useI18n()

  return (
    <ModulePlaceholder
      title={t('modules.rss.title')}
      description={t('modules.rss.description')}
    />
  )
}

export default RssPage
