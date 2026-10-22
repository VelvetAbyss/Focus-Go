import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { LEGAL_DOCUMENTS } from '../apps/web/src/shared/legal/policies.ts'
import { POLICY_VERSION, POLICY_PREVIOUS_VERSION, POLICY_OPERATOR } from '../apps/web/focus-go-api/legal/policyManifest.js'
import { origin, homeFor, escape, languageLinks, structuredData, breadcrumbs } from './website-schema.mjs'

export const legalRoutes = ['privacy', 'terms'].flatMap(name => [`/${name}/`, `/zh/${name}/`])
export async function buildLegalPages(output, release) {
  for (const [name, key] of [['privacy', 'privacy-policy'], ['terms', 'terms-of-service']]) {
    for (const lang of ['en', 'zh']) {
      const zh = lang === 'zh', route = `${zh ? '/zh' : ''}/${name}/`, d = LEGAL_DOCUMENTS[lang][key]
      const title = `${d.title} | Focus&go`, description = zh ? `Focus&go ${d.title}，版本 ${POLICY_VERSION}。${d.summary}` : `Focus&go ${d.title}, version ${POLICY_VERSION}. ${d.summary}`
      const sections = d.sections.map((s, i) => `<section id="section-${i + 1}"><h2>${escape(s.heading)}</h2>${s.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}</section>`).join('')
      const html = `<!doctype html><html lang="${zh ? 'zh-CN' : 'en'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="${origin}${route}">${languageLinks(`/${name}/`, `/zh/${name}/`)}<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${origin}${route}"><meta name="focusgo-site-release" content="${release}"><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/content.css?v=${release}">${structuredData({ route, lang, title, description, breadcrumb: d.title })}</head><body><a class="skip" href="#content">${zh ? '跳至正文' : 'Skip to content'}</a><header><nav aria-label="${zh ? '主导航' : 'Main navigation'}"><a class="brand" href="${homeFor(lang)}">Focus&amp;go</a><div><a href="${homeFor(lang)}">${zh ? '首页' : 'Home'}</a><a lang="${zh ? 'en' : 'zh-CN'}" href="${zh ? `/${name}/` : `/zh/${name}/`}">${zh ? 'English' : '中文'}</a><a class="button" href="https://app.nestflow.art/">${zh ? '打开应用' : 'Open the app'}</a></div></nav></header><main id="content">${breadcrumbs(lang, route, d.title)}<!--email_off--><article data-policy-document="${key}" data-policy-version="${POLICY_VERSION}"><p class="eyebrow">${zh ? '版本' : 'Version'} ${POLICY_VERSION}</p><h1>${escape(d.title)}</h1><p class="summary">${escape(d.summary)}</p>${sections}</article><!--/email_off--><section class="related"><h2>${zh ? '相关政策与历史版本' : 'Related policies and previous edition'}</h2><div><a href="${zh ? '/zh' : ''}/privacy/">${zh ? '隐私政策' : 'Privacy Policy'}</a><a href="${zh ? '/zh' : ''}/terms/">${zh ? '服务条款' : 'Terms of Service'}</a><a href="https://app.nestflow.art/legal/${key}?lang=${lang}&amp;version=${POLICY_PREVIOUS_VERSION}">${zh ? '查看历史版本' : 'Previous edition'} · ${POLICY_PREVIOUS_VERSION}</a></div></section></main><footer><p>Focus&amp;go · ${zh ? '个人运营者' : 'Operated personally by'} ${escape(POLICY_OPERATOR)} · <a href="mailto:support@nestflow.art">support@nestflow.art</a> · <a href="https://github.com/VelvetAbyss/Focus-Go">GitHub</a></p></footer></body></html>`
      const dir = path.join(output, route); await mkdir(dir, { recursive: true }); await writeFile(path.join(dir, 'index.html'), html)
    }
  }
  return legalRoutes
}
