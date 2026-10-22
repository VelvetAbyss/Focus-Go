import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'

export async function addWebsiteCounts(output, routes, release) {
  const source = await readFile(new URL('../apps/web/src/shared/metrics/anonymousCounts.ts', import.meta.url), 'utf8')
  await writeFile(path.join(output, 'assets/anonymous-counts.js'), ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText)
  for (const route of routes) {
    const file = path.join(output, route, 'index.html'), zh = route.startsWith('/zh/')
    const notice = `<aside id="anonymous-counts" class="anonymous-counts-notice" aria-label="${zh ? '匿名计数说明' : 'Anonymous counts notice'}"><p>${zh ? '本站使用自托管每日计数，记录页面浏览和打开应用，不发送用户标识、任务或笔记。应用另记本浏览器首次成功使用；这些分段计数不能关联为个人路径。选择只适用于当前站点；尊重浏览器隐私信号。' : 'Self-hosted daily totals count page views and app opens, without user identifiers, task text or notes. The app separately counts its first observed successful use in this browser. These totals cannot form an individual journey. Choices apply to this site; browser privacy signals take priority.'}</p><button type="button" disabled data-anonymous-counts-control aria-pressed="false">${zh ? '匿名计数设置' : 'Anonymous count settings'}</button></aside>`
    let html = await readFile(file, 'utf8')
    html = html.replace('</head>', `<link rel="stylesheet" href="/assets/anonymous-counts.css?v=${release}"></head>`).replace('</footer>', `${notice}</footer>`).replace('</body>', `<script type="module" src="/assets/anonymous-counts.js?v=${release}"></script></body>`)
    await writeFile(file, html)
  }
}
