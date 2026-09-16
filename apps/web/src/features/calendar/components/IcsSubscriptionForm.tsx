import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '../../../shared/i18n/useI18n'

type IcsSubscriptionFormProps = {
  onAdd: (name: string, url: string) => void
}

/**
 * Owns the ICS name/url fields for the same reason as CreateTaskDialogForm:
 * keeping them in CalendarPage state made every keystroke re-render both month
 * grids.
 */
export const IcsSubscriptionForm = ({ onAdd }: IcsSubscriptionFormProps) => {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  const submit = () => {
    const trimmedName = name.trim()
    const trimmedUrl = url.trim()
    if (!trimmedName || !trimmedUrl) return
    setName('')
    setUrl('')
    onAdd(trimmedName, trimmedUrl)
  }

  return (
    <>
      <Label htmlFor="ics-name">{t('calendar.name')}</Label>
      <Input id="ics-name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
      <Label htmlFor="ics-url">{t('calendar.icsUrl')}</Label>
      <Input
        id="ics-url"
        value={url}
        onChange={(event) => setUrl(event.currentTarget.value)}
        placeholder={t('calendar.icsPlaceholder')}
      />
      <Button type="button" onClick={submit}>
        {t('calendar.addIcsSubscription')}
      </Button>
    </>
  )
}

export default IcsSubscriptionForm
