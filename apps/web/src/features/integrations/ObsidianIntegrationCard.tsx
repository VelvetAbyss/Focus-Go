import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Plug, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchApi, getApiBase } from '../../shared/apiBase'
import { getAuth } from '../../store/auth'
import { useI18n } from '../../shared/i18n/useI18n'
import { useToast } from '../../shared/ui/toast/toast'

type IntegrationToken = {
  id: string
  name: string
  tokenPrefix: string
  createdAt: number
  lastUsedAt: number | null
}

const authHeaders = (): Record<string, string> => {
  const accessToken = getAuth()?.accessToken
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
}

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...authHeaders() })

/**
 * Long-lived access tokens for headless sync clients — the Obsidian plugin
 * being the first. The plaintext token exists only in the create response, so
 * it is held in component state until the user dismisses it and never refetched.
 */
const ObsidianIntegrationCard = () => {
  const { t, language } = useI18n()
  const toast = useToast()

  const [tokens, setTokens] = useState<IntegrationToken[]>([])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadTokens = useCallback(async () => {
    // Signed out: the endpoint would 401 and toast on mount for no reason.
    if (!getAuth()?.accessToken) return
    try {
      const response = await fetchApi('/integrations/tokens', { headers: authHeaders() })
      if (!response.ok) throw new Error(String(response.status))
      const body = (await response.json()) as { tokens: IntegrationToken[] }
      setTokens(body.tokens ?? [])
    } catch {
      toast.push({ message: t('settings.obsidian.loadFailed'), variant: 'error' })
    }
  }, [t, toast])

  useEffect(() => {
    void loadTokens()
  }, [loadTokens])

  const formatDate = (value: number) =>
    new Date(value).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed || creating) return
    setCreating(true)
    try {
      const response = await fetchApi('/integrations/tokens', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ name: trimmed }),
      })
      if (response.status === 409) {
        toast.push({ message: t('settings.obsidian.limitReached'), variant: 'error' })
        return
      }
      if (!response.ok) throw new Error(String(response.status))
      const created = (await response.json()) as { token: string }
      setFreshToken(created.token)
      setCopied(false)
      setName('')
      await loadTokens()
    } catch {
      toast.push({ message: t('settings.obsidian.createFailed'), variant: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!freshToken) return
    try {
      await navigator.clipboard.writeText(freshToken)
      setCopied(true)
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). The token is
      // on screen and selectable, so this is not worth an error toast.
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      const response = await fetchApi(`/integrations/tokens/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error(String(response.status))
      toast.push({ message: t('settings.obsidian.revoked'), variant: 'success' })
      await loadTokens()
    } catch {
      toast.push({ message: t('settings.obsidian.loadFailed'), variant: 'error' })
    }
  }

  // What the user must paste into the plugin's settings. The proxy-relative
  // '/api' base is useless outside the browser, so fall back to the origin.
  const apiBase = getApiBase()
  const pluginServerUrl = apiBase.startsWith('http')
    ? apiBase
    : `${window.location.origin}${apiBase}`

  return (
    <div className="grid gap-4 rounded-xl bg-background/40 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex gap-3">
        <div className="mt-0.5 rounded-md border border-border/80 bg-muted/60 p-2 text-muted-foreground">
          <Plug className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{t('settings.obsidian.title')}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('settings.obsidian.description')}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleCreate()
          }}
          maxLength={64}
          placeholder={t('settings.obsidian.namePlaceholder')}
        />
        <Button onClick={() => void handleCreate()} disabled={!name.trim() || creating}>
          {creating ? t('settings.obsidian.generating') : t('settings.obsidian.generate')}
        </Button>
      </div>

      {freshToken ? (
        <div className="grid gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {t('settings.obsidian.newTokenHeading')}
            </p>
            <p className="text-xs text-muted-foreground">{t('settings.obsidian.newTokenWarning')}</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-background/70 px-2 py-1.5 font-mono text-xs">
              {freshToken}
            </code>
            <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="ml-1.5">
                {copied ? t('settings.obsidian.copied') : t('settings.obsidian.copy')}
              </span>
            </Button>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('settings.obsidian.apiBaseLabel')}</p>
            <code className="block overflow-x-auto rounded-md bg-background/70 px-2 py-1.5 font-mono text-xs">
              {pluginServerUrl}
            </code>
          </div>
          <div>
            <Button variant="ghost" size="sm" onClick={() => setFreshToken(null)}>
              {t('settings.obsidian.dismiss')}
            </Button>
          </div>
        </div>
      ) : null}

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('settings.obsidian.empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium text-foreground">{token.name}</p>
                <p className="text-xs text-muted-foreground">
                  <code className="font-mono">{token.tokenPrefix}…</code>
                  {' · '}
                  {t('settings.obsidian.created', { date: formatDate(token.createdAt) })}
                  {' · '}
                  {token.lastUsedAt
                    ? t('settings.obsidian.lastUsed', { date: formatDate(token.lastUsedAt) })
                    : t('settings.obsidian.neverUsed')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('settings.obsidian.revoke')}
                onClick={() => void handleRevoke(token.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="ml-1.5">{t('settings.obsidian.revoke')}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default ObsidianIntegrationCard
