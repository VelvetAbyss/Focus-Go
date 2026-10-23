import { POLICY_OPERATOR } from '../apps/web/focus-go-api/legal/policyManifest.js'

export const origin = 'https://nestflow.art'
export const homeFor = lang => lang === 'zh' ? '/zh/' : '/'
export const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export const languageLinks = (en, zh) => `<link rel="alternate" hreflang="en" href="${origin}${en}"><link rel="alternate" hreflang="zh-CN" href="${origin}${zh}"><link rel="alternate" hreflang="x-default" href="${origin}${en}">`
export function breadcrumbs(lang, route, name) {
  return `<nav class="breadcrumbs" aria-label="${lang === 'zh' ? '面包屑导航' : 'Breadcrumb'}"><ol><li><a href="${homeFor(lang)}">${lang === 'zh' ? '首页' : 'Home'}</a></li><li aria-current="page">${escape(name)}</li></ol></nav>`
}
export function structuredData({ route, lang, title, description, breadcrumb, application = false, pageType }) {
  const person = { '@type': 'Person', '@id': `${origin}/#maintainer`, name: POLICY_OPERATOR, url: `${origin}/#maintainer` }
  const website = { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'Focus&go', url: `${origin}/`, inLanguage: ['en', 'zh-CN'], publisher: { '@id': person['@id'] } }
  const page = { '@type': pageType === 'AboutPage' ? ['WebPage', 'AboutPage'] : 'WebPage', '@id': `${origin}${route}#webpage`, url: `${origin}${route}`, name: title, description, inLanguage: lang === 'zh' ? 'zh-CN' : 'en', isPartOf: { '@id': website['@id'] }, publisher: { '@id': person['@id'] } }
  const graph = [person, website, page]
  if (application) {
    const software = { '@type': ['SoftwareApplication', 'WebApplication'], '@id': `${origin}/#application`, name: 'Focus&go', url: `${origin}/`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web browser', browserRequirements: 'A supported modern Web browser', description: lang === 'zh' ? '整合任务、番茄钟、笔记与日记的个人工作台。当前功能免费，官方 Web 版的受保护交互需要登录。' : 'A personal workspace for tasks, a Pomodoro timer, notes and a diary. Current features are free; protected interactions on the official Web app require sign-in.', isAccessibleForFree: true, offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', url: 'https://app.nestflow.art/' }, publisher: { '@id': person['@id'] }, license: 'https://github.com/VelvetAbyss/Focus-Go/blob/main/LICENSE', sameAs: ['https://github.com/VelvetAbyss/Focus-Go'] }
    graph.push(software)
    page.about = { '@id': software['@id'] }
    if (pageType === 'AboutPage') page.mainEntity = { '@id': software['@id'] }
  }
  if (breadcrumb) {
    const trail = { '@type': 'BreadcrumbList', '@id': `${origin}${route}#breadcrumb`, itemListElement: [{ '@type': 'ListItem', position: 1, name: lang === 'zh' ? '首页' : 'Home', item: `${origin}${homeFor(lang)}` }, { '@type': 'ListItem', position: 2, name: breadcrumb, item: `${origin}${route}` }] }
    graph.push(trail); page.breadcrumb = { '@id': trail['@id'] }
  }
  // JSON-LD is data, never executable markup; prevent embedded closing tags.
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c')}</script>`
}
