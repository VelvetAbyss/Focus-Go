import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const content = JSON.parse(await readFile(new URL('./website-content.json', import.meta.url), 'utf8'))
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const urlFor = (page, lang) => `/${lang === 'zh' ? 'zh/' : ''}${page.path}/`
const copy = {
  en: { home: 'Home', open: 'Open the app', related: 'Explore the workspace', faq: 'Questions before you start', checked: 'Content checked: 22 October 2026', sources: 'Product documentation and current behavior', privacy: 'Privacy', switch: '中文', note: 'Focus&go is the product; nestflow.art is its official home. All current features are free. The official Web app requires sign-in for protected interactions. Cloud sync defaults to enabled on a new device and can be disabled in Settings.' },
  zh: { home: '首页', open: '打开应用', related: '继续了解工作台', faq: '开始前的问题', checked: '内容核对：2026 年 10 月 22 日', sources: '产品说明与当前行为', privacy: '隐私政策', switch: 'English', note: 'Focus&go 是产品名称，nestflow.art 是官方归属域名。所有当前功能免费；官方 Web 版的受保护交互需要登录。新设备云同步默认开启，可在设置中关闭。' },
}

export async function buildContentPages(output, release) {
  for (const page of content) {
    for (const lang of ['en', 'zh']) {
      const c = page[lang], t = copy[lang], route = urlFor(page, lang)
      const navigation = content.map(item => `<a href="${urlFor(item, lang)}"${item.path === page.path ? ' aria-current="page"' : ''}>${escape(item[lang].h1)}</a>`).join('')
      const sections = c.sections.map(section => `<section><h2>${escape(section.title)}</h2>${section.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}</section>`).join('')
      const questions = c.faq.map(item => `<div class="question"><h3>${escape(item.q)}</h3><p>${escape(item.a)}</p></div>`).join('')
      const html = `<!doctype html>
<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(c.title)}</title><meta name="description" content="${escape(c.description)}"><link rel="canonical" href="https://nestflow.art${route}">
<link rel="alternate" hreflang="en" href="https://nestflow.art${urlFor(page, 'en')}"><link rel="alternate" hreflang="zh-CN" href="https://nestflow.art${urlFor(page, 'zh')}"><link rel="alternate" hreflang="x-default" href="https://nestflow.art${urlFor(page, 'en')}">
<meta property="og:title" content="${escape(c.title)}"><meta property="og:description" content="${escape(c.description)}"><meta property="og:type" content="article"><meta property="og:url" content="https://nestflow.art${route}"><meta property="og:image" content="https://nestflow.art/assets/product-dashboard.png">
<meta name="focusgo-site-release" content="${escape(release)}"><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/content.css"></head>
<body><a class="skip" href="#content">${lang === 'zh' ? '跳至正文' : 'Skip to content'}</a><header><nav aria-label="${lang === 'zh' ? '主导航' : 'Main navigation'}"><a class="brand" href="/">Focus&amp;go</a><div><a href="/">${t.home}</a><a lang="${lang === 'zh' ? 'en' : 'zh-CN'}" href="${urlFor(page, lang === 'zh' ? 'en' : 'zh')}">${t.switch}</a><a class="button" href="https://app.nestflow.art/">${t.open}</a></div></nav></header>
<main id="content"><article><p class="eyebrow">Focus&amp;go · ${t.checked}</p><h1>${escape(c.h1)}</h1><p class="summary">${escape(c.summary)}</p>${sections}<section><h2>${t.faq}</h2>${questions}</section><aside><h2>${t.sources}</h2><p><a href="https://github.com/VelvetAbyss/Focus-Go/blob/e21f3b89452f94753bbd7687bc394e030269df7f/README.md">README · MIT</a> · <a href="https://github.com/VelvetAbyss/Focus-Go/tree/e21f3b89452f94753bbd7687bc394e030269df7f/apps/web/src/features/focus">${lang === 'zh' ? '专注功能' : 'Focus functionality'}</a> · <a href="https://app.nestflow.art/workspace/settings/legal/privacy-policy">${t.privacy}</a></p><p>${escape(t.note)}</p></aside></article><section class="related"><h2>${t.related}</h2><div>${navigation}</div></section></main><footer><p>Focus&amp;go · nestflow.art · <a href="https://github.com/VelvetAbyss/Focus-Go">GitHub</a> · <a href="mailto:support@nestflow.art">support@nestflow.art</a></p></footer></body></html>`
      const dir = path.join(output, route)
      await mkdir(dir, { recursive: true })
      await writeFile(path.join(dir, 'index.html'), html)
    }
  }
  return content.flatMap(page => ['en', 'zh'].map(lang => urlFor(page, lang)))
}
