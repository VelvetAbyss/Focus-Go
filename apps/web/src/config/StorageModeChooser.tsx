import { requestSignInPrompt, writeStorageMode, type StorageMode } from '../data/storageMode'

// This screen renders *before* the app boots (i18n messages, theme and the
// preferences provider are not up yet), so — like StartupGate — it carries its
// own copy in both languages rather than going through `t()`.
const COPY = {
  zh: {
    title: '选择数据存放方式',
    subtitle: '这台设备上的工作区数据保存在哪里。之后可以在「设置 → 数据」里随时更改。',
    local: {
      name: '本地模式',
      tagline: '无需账号，数据只留在这台设备',
      points: ['不用注册或登录，打开即用', '全部数据存在本机，完全离线可用', '可随时导出备份；换设备需自己迁移'],
      action: '直接开始使用',
    },
    cloud: {
      name: '云端同步',
      tagline: '登录账号，多台设备共用一个工作区',
      points: ['电脑、网页、手机浏览器数据实时同步', '数据在服务器有备份，换设备直接登录', '需要注册并登录账号'],
      action: '登录并开启同步',
    },
    footnote: '两种模式都先把数据写在本地，云端同步只是额外多一份服务器副本。',
  },
  en: {
    title: 'Where should your data live?',
    subtitle: 'Choose how this device stores your workspace. You can change it any time in Settings → Data.',
    local: {
      name: 'Local only',
      tagline: 'No account. Your data never leaves this device.',
      points: ['No sign-up, no sign-in — just start', 'Everything stays on this machine, fully offline', 'Export a backup any time; moving devices is manual'],
      action: 'Start using it now',
    },
    cloud: {
      name: 'Cloud sync',
      tagline: 'Sign in and share one workspace across devices',
      points: ['Desktop, web and mobile browser stay in step', 'Your data is backed up on the server', 'Requires an account'],
      action: 'Sign in and sync',
    },
    footnote: 'Both modes write to this device first — cloud sync just keeps an extra copy on the server.',
  },
} as const

export default function StorageModeChooser({ onChoose }: { onChoose: (mode: StorageMode) => void }) {
  const english = typeof navigator !== 'undefined' && !navigator.language.startsWith('zh')
  const copy = english ? COPY.en : COPY.zh

  const choose = (mode: StorageMode) => {
    writeStorageMode(mode)
    // Picking cloud sync is an intent to sign in — say so immediately instead of
    // dropping the user into a workspace that silently refuses every edit.
    if (mode === 'cloud') requestSignInPrompt()
    onChoose(mode)
  }

  return (
    <main className="storage-mode-screen">
      <header className="storage-mode-screen__head">
        <h1>Focus &amp; Go</h1>
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </header>

      <div className="storage-mode-screen__options">
        {(['local', 'cloud'] as const).map((mode) => {
          const option = copy[mode]
          return (
            <section key={mode} className="storage-mode-card">
              <h3>{option.name}</h3>
              <p className="storage-mode-card__tagline">{option.tagline}</p>
              <ul>
                {option.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <button
                type="button"
                className={`storage-mode-card__action${mode === 'local' ? ' storage-mode-card__action--primary' : ''}`}
                onClick={() => choose(mode)}
              >
                {option.action}
              </button>
            </section>
          )
        })}
      </div>

      <p className="storage-mode-screen__footnote">{copy.footnote}</p>
    </main>
  )
}
