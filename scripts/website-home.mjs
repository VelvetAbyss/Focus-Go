import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { origin, escape, languageLinks, structuredData } from './website-schema.mjs'

// The authored home translation is a string-only object. Parse it as data;
// never execute the site's scripts or use a browser during the build.
function translations(source) {
  const literal = source.match(/const ZH = (\{[\s\S]*?\n\});/)?.[1]
  if (!literal) throw new Error('Home Chinese dictionary missing')
  const ast = ts.createSourceFile('home-translations.js', `(${literal})`, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const object = ast.statements[0]?.expression?.expression
  if (!ts.isObjectLiteralExpression(object)) throw new Error('Invalid home dictionary')
  return Object.fromEntries(object.properties.map(property => {
    if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.name) || !ts.isStringLiteral(property.initializer)) throw new Error('Home translations must be authored string literals')
    return [property.name.text, property.initializer.text]
  }))
}
const copy = {
  en: { title: 'Focus&go — Free task manager, Pomodoro timer & notes', description: 'Focus&go brings tasks, a Pomodoro timer, notes and a diary into one personal workspace. All current features are free, with local-first saving and configurable cloud sync.' },
  zh: { title: 'Focus&go — 免费任务管理、番茄钟与笔记工作台', description: 'Focus&go 将任务、番茄钟、笔记与日记整合在同一个个人工作台。所有当前功能免费，内容优先保存在本机，官方 Web 版的受保护交互需要登录。' },
}
export async function buildHomePages(output, source, release) {
  const zh = translations(source)
  for (const lang of ['en', 'zh']) {
    const route = lang === 'zh' ? '/zh/' : '/', c = copy[lang]
    let html = source
    if (lang === 'zh') {
      html = html.replace(/<([a-z][a-z0-9]*)\b([^>]*\bdata-i18n(?:-html)?="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/gi, (_, tag, attrs, key) => {
        if (!(key in zh)) throw new Error(`Missing home translation: ${key}`)
        return `<${tag}${attrs}>${zh[key]}</${tag}>`
      })
      html = html.replace('aria-label="Focus&go demo: open the dashboard, type a task, press Enter, start the focus timer"', 'aria-label="Focus&go 演示：打开仪表盘、输入任务、按回车，再开始专注计时"').replace('aria-label="Close"', 'aria-label="关闭"').replace('aria-label="Command palette preview"', 'aria-label="命令面板预览"')
      html = html.replace('<html lang="en">', '<html lang="zh-CN">').replace('<body>', '<body class="zh">')
      html = html.replace('href="/zh/" lang="zh-CN" hreflang="zh-CN"', 'href="/" lang="en" hreflang="en"')
      html = html.replace(/(<a\b[^>]*\bid="langToggle"[^>]*>)[\s\S]*?<\/a>/, '$1EN</a>')
      for (const route of ['/features/pomodoro/', '/features/local-first/', '/guides/task-to-focus/', '/privacy/', '/terms/']) html = html.replaceAll(`href="${route}"`, `href="/zh${route}"`)
    }
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(c.title)}</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escape(c.description)}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escape(c.title)}">`)
      .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escape(c.description)}">`)
      .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${origin}${route}">`)
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${origin}${route}">${languageLinks('/', '/zh/')}`)
      .replace('</head>', `<meta name="focusgo-site-release" content="${release}">${structuredData({ route, lang, title: c.title, description: c.description, application: true })}</head>`)
    // Translation is complete in initial HTML; only the quiz and diagram use JS.
    html = html.replace(/const ZH = \{[\s\S]*?\n\};/, '')
    const dir = path.join(output, route); await mkdir(dir, { recursive: true }); await writeFile(path.join(dir, 'index.html'), html)
  }
  return ['/', '/zh/']
}
