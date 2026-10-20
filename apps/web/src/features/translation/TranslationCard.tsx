import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeftRight, Copy, Maximize2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../../app/routes/routes'
import Card from '../../shared/ui/Card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '../../shared/i18n/useI18n'
import { installPacks, readyPacks, removePack, translateOffline, type DownloadProgress } from './offline'
import { translateOnline } from './online'
import { businessSuggestions } from './business'
import {
  BUSINESS_EXPRESSIONS, LANGUAGES, MAX_TEXT_LENGTH, MODEL_PACKS, TranslationError,
  modelRoute, resolveSource,
  type Language, type ModelPack, type SourceLanguage, type TranslationErrorCode, type TranslationMode,
} from './translation'
import './translation.css'

const ERRORS: Record<TranslationErrorCode, [string, string]> = {
  quota: ['在线免费额度已用尽，今天已停止调用。可下载语言包后离线翻译。', 'The free online quota is exhausted. Requests are stopped for today. Use a downloaded offline pack.'],
  network: ['在线服务暂不可用。请稍后重试，或使用离线翻译。', 'The online service is unavailable. Try later or use offline translation.'],
  storage: ['无法保存语言包。请检查可用空间、浏览器存储权限和隐私模式。', 'Unable to save the language pack. Check free space, storage permissions and private browsing.'],
  download: ['语言包下载未完成。可重试，已完成的文件会保留。', 'The language pack download did not finish. Retry to reuse completed files.'],
  'missing-pack': ['请先下载所选语向的离线语言包。', 'Download the offline packs for this language pair first.'],
  unsupported: ['该语言暂不支持离线翻译，请使用在线模式或选择其他语言。', 'This language is not available offline. Use online mode or choose another language.'],
  empty: ['请先输入要翻译的内容。', 'Enter some text to translate.'],
  'too-long': ['单次最多支持 20,000 个字符，请分段处理。', 'Translate up to 20,000 characters at a time.'],
  runtime: ['本地翻译未能完成。请关闭其他占用内存的页面后重试。', 'Offline translation failed. Close other memory-heavy tabs and retry.'],
}

const mb = (bytes: number) => `${Math.ceil(bytes / 1_000_000)} MB`
const packSize = (pack: ModelPack) => pack.files.reduce((sum, file) => sum + file.bytes, 0)

function readChoice(): { source: SourceLanguage; target: Language; mode: TranslationMode } {
  const defaults = { source: 'auto' as const, target: 'zh' as const, mode: 'online' as const }
  try {
    const saved = JSON.parse(localStorage.getItem('focusgo.translation.preferences') || '{}')
    return {
      source: saved.source === 'auto' || LANGUAGES.some(language => language.id === saved.source) ? saved.source : defaults.source,
      target: LANGUAGES.some(language => language.id === saved.target) ? saved.target : defaults.target,
      mode: saved.mode === 'offline' ? 'offline' : 'online',
    }
  } catch { return defaults }
}

export default function TranslationCard({ fullPage = false }: { fullPage?: boolean }) {
  const { language } = useI18n()
  const zh = language === 'zh'
  const label = (cn: string, en: string) => zh ? cn : en
  const [choice, setChoice] = useState(readChoice)
  const { source, target, mode } = choice
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [resultMode, setResultMode] = useState<TranslationMode | 'template' | null>(null)
  const [adjusted, setAdjusted] = useState(false)
  const [busy, setBusy] = useState<'translate' | 'download' | null>(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [connected, setConnected] = useState(navigator.onLine)
  const controller = useRef<AbortController | null>(null)
  const request = useRef(0)
  const id = useId()
  const actualSource = resolveSource(source, input)
  const languageName = (code: string) => {
    const entry = LANGUAGES.find(item => item.id === code)
    return entry ? zh ? entry.zh : entry.en : code
  }
  let route: ModelPack[] = []
  let offlineSupported = true
  try { route = modelRoute(actualSource, target) } catch { offlineSupported = false }
  const missing = route.filter(pack => !ready.includes(pack.id))

  useEffect(() => {
    let active = true
    void readyPacks().then(packs => { if (active) setReady(packs) })
    const onNetwork = () => setConnected(navigator.onLine)
    window.addEventListener('online', onNetwork)
    window.addEventListener('offline', onNetwork)
    return () => {
      active = false
      controller.current?.abort()
      window.removeEventListener('online', onNetwork)
      window.removeEventListener('offline', onNetwork)
    }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('focusgo.translation.preferences', JSON.stringify(choice)) } catch { /* Still usable. */ }
  }, [choice])

  const cancel = () => {
    request.current++
    controller.current?.abort()
    controller.current = null
    setBusy(null)
    setProgress('')
  }
  const invalidate = () => { cancel(); setError(''); setResult(''); setResultMode(null); setCopied(false); setAdjusted(false) }
  const changeChoice = (next: Partial<typeof choice>) => { invalidate(); setChoice(previous => ({ ...previous, ...next })) }
  const reportError = (cause: unknown) => {
    const code = cause instanceof TranslationError ? cause.code : 'runtime'
    setError(ERRORS[code][zh ? 0 : 1])
  }

  const translate = async () => {
    cancel()
    const current = ++request.current
    const aborter = new AbortController()
    controller.current = aborter
    setBusy('translate'); setError(''); setResult(''); setResultMode(null); setCopied(false); setAdjusted(false)
    setProgress(label('准备翻译…', 'Preparing…'))
    try {
      if (!input.trim()) throw new TranslationError('empty')
      if (input.length > MAX_TEXT_LENGTH) throw new TranslationError('too-long')
      if (mode === 'online' && !navigator.onLine) throw new TranslationError('network')
      const run = mode === 'online' ? translateOnline : translateOffline
      const output = await run(input, actualSource, target, aborter.signal, (done, total) => {
        if (current === request.current) setProgress(`${label('翻译中', 'Translating')} ${done}/${total}`)
      })
      if (current === request.current) { setResult(output); setResultMode(mode) }
    } catch (cause) {
      if (current === request.current && !aborter.signal.aborted) reportError(cause)
    } finally {
      if (current === request.current) { setBusy(null); setProgress(''); controller.current = null }
    }
  }

  const download = async (packs: ModelPack[]) => {
    cancel()
    const current = ++request.current
    const aborter = new AbortController()
    controller.current = aborter
    setBusy('download'); setError(''); setProgress(label('准备下载…', 'Preparing download…'))
    try {
      await installPacks(packs, aborter.signal, ({ loaded, total }: DownloadProgress) => {
        if (current === request.current) setProgress(`${label('下载语言包', 'Downloading')} ${mb(loaded)} / ${mb(total)}`)
      })
    } catch (cause) {
      if (current === request.current && !aborter.signal.aborted) reportError(cause)
    } finally {
      const packs = await readyPacks()
      setReady(packs)
      if (current === request.current) { setBusy(null); setProgress(''); controller.current = null }
    }
  }

  const editor = (
    <div className="translation-editor" data-testid="translation-editor">
      <div className="translation-toolbar">
        <div className="translation-mode" role="group" aria-label={label('翻译方式', 'Translation mode')}>
          {(['online', 'offline'] as const).map(value => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => changeChoice({ mode: value })}>
              {value === 'online' ? label('在线', 'Online') : label('离线', 'Offline')}
            </button>
          ))}
        </div>
        <span className="translation-meta">{label('免费机翻', 'Free machine translation')}</span>
      </div>
      <div className="translation-languages">
        <label>
          <span className="sr-only">{label('原文语言', 'Source language')}</span>
          <select aria-label={label('原文语言', 'Source language')} value={source} onChange={event => changeChoice({ source: event.target.value as SourceLanguage })}>
            <option value="auto">{label('自动识别（中英）', 'Auto (Chinese / English)')}</option>
            {LANGUAGES.map(item => <option key={item.id} value={item.id}>{zh ? item.zh : item.en}</option>)}
          </select>
        </label>
        <button type="button" className="translation-icon" title={label('交换语言', 'Swap languages')} aria-label={label('交换语言', 'Swap languages')}
          onClick={() => {
            const previous = actualSource
            const next = result || input
            invalidate(); setChoice(current => ({ ...current, source: target, target: previous })); setInput(next)
          }}><ArrowLeftRight size={16} /></button>
        <label>
          <span className="sr-only">{label('译文语言', 'Target language')}</span>
          <select aria-label={label('译文语言', 'Target language')} value={target} onChange={event => changeChoice({ target: event.target.value as Language })}>
            {LANGUAGES.map(item => <option key={item.id} value={item.id}>{zh ? item.zh : item.en}</option>)}
          </select>
        </label>
      </div>
      <p className="translation-notice" id={`${id}-notice`}>
        {mode === 'online'
          ? label('发送至 MyMemory，服务商会保存文本。敏感内容请选离线。匿名免费额度 5,000 字符/天，用尽即停止。', 'Sent to MyMemory, which retains submitted text. Use offline for sensitive content. Anonymous quota: 5,000 characters/day; stops at the limit.')
          : label('使用已下载的语言包，文本留在本机。清理浏览器数据后需要重新下载。', 'Uses downloaded packs; text stays on this device. Clearing browser data removes packs.')}
      </p>
      {mode === 'online' && !connected && <button type="button" className="translation-link" onClick={() => changeChoice({ mode: 'offline' })}>{label('当前无网络，切换离线翻译', 'No connection. Switch to offline translation')}</button>}
      <div className="translation-texts">
        <div className="translation-pane">
          <label htmlFor={`${id}-source`}>{label('原文', 'Source')}</label>
          <textarea id={`${id}-source`} value={input} maxLength={MAX_TEXT_LENGTH} spellCheck={false}
            aria-describedby={`${id}-notice`} placeholder={label('输入或粘贴要翻译的内容…', 'Type or paste text to translate…')}
            onChange={event => { invalidate(); setInput(event.target.value) }}
            onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void translate() } }} />
          <div className="translation-pane-foot"><span>{input.length.toLocaleString()} / 20,000</span><button type="button" onClick={() => { invalidate(); setInput('') }} disabled={!input}>{label('清空', 'Clear')}</button></div>
        </div>
        <div className="translation-pane translation-pane--result">
          <label htmlFor={`${id}-result`}>{label('译文', 'Translation')}</label>
          <textarea id={`${id}-result`} value={result} readOnly placeholder={label('译文显示在这里', 'Your translation appears here')} dir="auto" />
          <div className="translation-pane-foot">
            <span>{resultMode === 'online' ? 'MyMemory' : resultMode === 'offline' ? 'OPUS-MT · ' + label('本机', 'On device') : resultMode === 'template' ? label('预设表达', 'Template') : ''}{adjusted ? label(' · 已调整表达', ' · Style adjusted') : ''}</span>
            <button type="button" disabled={!result} onClick={async () => {
              try { await navigator.clipboard.writeText(result); setCopied(true) }
              catch { setError(label('复制失败，请选中译文手动复制。', 'Copy failed. Select and copy the translation manually.')) }
            }}><Copy size={13} />{copied ? label('已复制', 'Copied') : label('复制', 'Copy')}</button>
          </div>
        </div>
      </div>
      <div className="translation-submit">
        {busy ? <button type="button" onClick={cancel}><X size={14} />{label('取消', 'Cancel')}</button>
          : <button type="button" className="translation-primary" disabled={!input.trim() || (mode === 'offline' && (!offlineSupported || missing.length > 0))} onClick={() => void translate()}>{label('翻译', 'Translate')}<span aria-hidden="true">↵</span></button>}
        <span role="status" aria-live="polite" className="translation-meta">{progress || (route.length > 1 && mode === 'offline' ? label('经英语中转，可能损失部分准确度', 'Via English; some accuracy may be lost') : '')}</span>
      </div>
      {error && <p role="alert" className="translation-error">{error}</p>}
      {mode === 'offline' && (!offlineSupported
        ? <p className="translation-notice">{label('离线支持中、英、德、法、西语，其他语种请选择在线模式。', 'Offline supports Chinese, English, German, French and Spanish. Use online for other languages.')}</p>
        : missing.length > 0 && <div className="translation-pack-prompt"><span>{label('所选语向尚缺', 'Missing packs')}: {missing.map(pack => pack.id).join(', ')}</span><button type="button" disabled={!!busy || !connected} onClick={() => void download(missing)}>{label('下载', 'Download')} · {mb(missing.reduce((sum, pack) => sum + packSize(pack), 0))}</button></div>)}
      {target === 'en' && result && <details className="translation-details">
        <summary>{label('商务表达调整', 'Business style')}</summary>
        <p className="translation-notice">{label('使用本机规则提供措辞建议，逐条预览后采用。仅处理部分英文表达，请自行核对语境。', 'Local rules offer wording suggestions for review. Limited English patterns; check the context before applying.')}</p>
        <div className="translation-style">{businessSuggestions(result).length ? businessSuggestions(result).map(suggestion => <div key={suggestion.before}>
          <span>{suggestion.reason[zh ? 0 : 1]}</span><del>{suggestion.before}</del><p>{suggestion.after}</p>
          <button type="button" onClick={() => { setResult(current => current.replace(suggestion.before, suggestion.after)); setAdjusted(true); setCopied(false) }}>{label('采用', 'Apply')}</button>
        </div>) : <p className="translation-notice">{label('暂无匹配的措辞建议。', 'No matching style suggestions.')}</p>}</div>
      </details>}
      <details className="translation-details">
        <summary>{label('商务表达参考', 'Business expressions')}</summary>
        <p className="translation-notice">{label('预设双语表达，可放入原文继续编辑；不提供自由改写。', 'Reviewed bilingual templates. Insert and edit as needed; no free-form rewriting.')}</p>
        <div className="translation-expressions">{BUSINESS_EXPRESSIONS.map(expression => <button type="button" key={expression.en} onClick={() => {
          invalidate(); setChoice(current => ({ ...current, source: 'zh', target: 'en' })); setInput(expression.zh); setResult(expression.en); setResultMode('template')
        }}><span>{expression.zh}</span><span lang="en">{expression.en}</span></button>)}</div>
      </details>
      <details className="translation-details">
        <summary>{label('离线语言包', 'Offline language packs')} · {ready.length}/8</summary>
        <p className="translation-notice">{label('首次下载需联网，每个语向约 112–120 MB，另需共享运行库。按需下载即可。', 'Download once while online: about 112–120 MB per direction plus a shared runtime. Install only what you need.')}</p>
        <div className="translation-packs">{MODEL_PACKS.map(pack => <div key={pack.id}>
          <span>{pack.id.split('-').map(languageName).join(' → ')}<small>{mb(packSize(pack))}</small></span>
          {ready.includes(pack.id) ? <button type="button" disabled={!!busy} onClick={() => {
            void removePack(pack).then(readyPacks).then(setReady).catch(reportError)
          }}>{label('移除', 'Remove')}</button> : <button type="button" disabled={!!busy || !connected} onClick={() => void download([pack])}>{label('下载', 'Download')}</button>}
        </div>)}</div>
        <p className="translation-notice"><a href="https://github.com/Helsinki-NLP/Opus-MT" target="_blank" rel="noreferrer">OPUS-MT</a> · <a href="https://github.com/huggingface/transformers.js" target="_blank" rel="noreferrer">Transformers.js</a> · <a href="https://mymemory.translated.net/terms-and-conditions" target="_blank" rel="noreferrer">{label('在线服务条款', 'Online terms')}</a></p>
        <p className="translation-notice">Helsinki-NLP / Jörg Tiedemann {label('及贡献者；Xenova ONNX / 8-bit 转换。', 'and contributors; Xenova ONNX / 8-bit conversions.')} <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a> / <a href="https://www.apache.org/licenses/LICENSE-2.0" target="_blank" rel="noreferrer">Apache 2.0</a></p>
      </details>
    </div>
  )

  if (fullPage) return editor

  return <>
    <Card title={label('翻译', 'Translate')} eyebrow={label('随手译一段', 'Across languages')} className="translation-card"
      actions={<><Link className="translation-link" to={ROUTES.TRANSLATION}>{label('详情页', 'Full page')}</Link><button type="button" className="translation-icon" aria-label={label('展开翻译', 'Expand translation')} title={label('展开翻译', 'Expand translation')} onClick={() => setExpanded(true)}><Maximize2 size={16} /></button></>}>
      {!expanded ? editor : <button className="translation-link" type="button" onClick={() => setExpanded(false)}>{label('翻译窗口已展开 · 返回卡片', 'Workspace expanded · Return to card')}</button>}
    </Card>
    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className="translation-dialog">
        <DialogTitle>{label('翻译', 'Translate')}</DialogTitle>
        <DialogDescription className="sr-only">{label('选择语言，输入内容，使用在线服务或已下载的离线语言包翻译。', 'Choose languages and enter text. Translate online or with downloaded offline packs.')}</DialogDescription>
        {expanded && editor}
      </DialogContent>
    </Dialog>
  </>
}
