const DEFAULT_TTL_MS = 30 * 60 * 1000
const DEFAULT_LIMIT = 30

// Public newsnow API — used for sources whose direct scrapers are fragile.
// newsnow team maintains the scrapers; we just proxy + cache.
const NEWSNOW_BASE = 'https://newsnow.busiyi.world'

const requestHeaders = {
  'user-agent': 'Mozilla/5.0 FocusGoNews/1.0 (+https://nestflow.art)',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
}

export const NEWS_SOURCES = {
  // ── Hot ────────────────────────────────────────────────────────────────
  zhihu:       { id: 'zhihu',       name: '知乎',       category: 'hot',     type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://www.zhihu.com/hot',              accent: '#2f6f9f' },
  weibo:       { id: 'weibo',       name: '微博',       category: 'hot',     type: 'hottest',  interval:  2 * 60 * 1000, home: 'https://s.weibo.com/top/summary',        accent: '#c95f38' },
  baidu:       { id: 'baidu',       name: '百度热搜',   category: 'hot',     type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://top.baidu.com/board?tab=realtime', accent: '#3d6ea8' },
  toutiao:     { id: 'toutiao',     name: '今日头条',   category: 'hot',     type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://www.toutiao.com/',               accent: '#b84a3a' },
  bilibili:    { id: 'bilibili',    name: '哔哩哔哩',   category: 'hot',     type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://www.bilibili.com/',              accent: '#4a8ec4' },
  douyin:      { id: 'douyin',      name: '抖音',       category: 'hot',     type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://www.douyin.com/',                accent: '#3A3733' },
  hackernews:  { id: 'hackernews',  name: 'Hacker News',category: 'hot',     type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://news.ycombinator.com/',          accent: '#c77a32' },
  github:      { id: 'github',      name: 'GitHub',     category: 'hot',     type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://github.com/trending',            accent: '#3A3733' },
  xiaoheihe:   { id: 'xiaoheihe',   name: '小黑盒',     category: 'hot',     type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://xiaoheihe.cn/',                  accent: '#3a86ff' },
  // ── Tech ───────────────────────────────────────────────────────────────
  ithome:      { id: 'ithome',      name: 'IT之家',     category: 'tech',    type: 'realtime', interval: 10 * 60 * 1000, home: 'https://www.ithome.com/list/',           accent: '#be4a35' },
  sspai:       { id: 'sspai',       name: '少数派',     category: 'tech',    type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://sspai.com/',                    accent: '#c7554a' },
  '36kr':      { id: '36kr',        name: '36氪',       category: 'tech',    type: 'realtime', interval: 10 * 60 * 1000, home: 'https://36kr.com/newsflashes',           accent: '#4e6d88' },
  producthunt: { id: 'producthunt', name: 'Product Hunt',category: 'tech',   type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://www.producthunt.com/',          accent: '#cf6f42' },
  v2ex:        { id: 'v2ex',        name: 'V2EX',       category: 'tech',    type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://v2ex.com/',                     accent: '#5a7a8a' },
  juejin:      { id: 'juejin',      name: '掘金',       category: 'tech',    type: 'hottest',  interval: 10 * 60 * 1000, home: 'https://juejin.cn/',                    accent: '#1e80ff' },
  // ── Finance ────────────────────────────────────────────────────────────
  wallstreetcn:{ id: 'wallstreetcn',name: '华尔街见闻', category: 'finance', type: 'realtime', interval:  5 * 60 * 1000, home: 'https://wallstreetcn.com/live/global',   accent: '#8a6b36' },
  cls:         { id: 'cls',         name: '财联社',     category: 'finance', type: 'realtime', interval:  5 * 60 * 1000, home: 'https://www.cls.cn/telegraph',           accent: '#8b5f2b' },
  xueqiu:      { id: 'xueqiu',      name: '雪球',       category: 'finance', type: 'hottest',  interval:  2 * 60 * 1000, home: 'https://xueqiu.com/hq',                 accent: '#537f6b' },
  jin10:       { id: 'jin10',       name: '金十数据',   category: 'finance', type: 'realtime', interval:  5 * 60 * 1000, home: 'https://www.jin10.com/',                accent: '#7a6030' },
  gelonghui:   { id: 'gelonghui',   name: '格隆汇',     category: 'finance', type: 'realtime', interval:  5 * 60 * 1000, home: 'https://www.gelonghui.com/',            accent: '#6b5a2a' },
}

export const ensureNewsTables = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS news_cache (
      source_id TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL,
      items_json TEXT NOT NULL
    )
  `)
}

const decodeHtml = (value) =>
  String(value ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, ' ')
    .replace(/&nbsp;/g, ' ')

const stripTags = (value) => decodeHtml(String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())

const fetchText = async (url, init = {}, fetchImpl = fetch) => {
  const response = await fetchImpl(url, {
    ...init,
    headers: { ...requestHeaders, ...(init.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.text()
}

const fetchJson = async (url, init = {}, fetchImpl = fetch) => {
  const response = await fetchImpl(url, {
    ...init,
    headers: { ...requestHeaders, ...(init.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json()
}

const normalizeItems = (items) =>
  (Array.isArray(items) ? items : [])
    .filter((item) => item && item.id != null && item.title && item.url)
    .slice(0, DEFAULT_LIMIT)
    .map((item) => ({
      id: String(item.id),
      title: stripTags(item.title),
      url: String(item.url),
      mobileUrl: item.mobileUrl ? String(item.mobileUrl) : undefined,
      pubDate: item.pubDate,
      extra: item.extra && typeof item.extra === 'object' ? item.extra : undefined,
    }))

const parseRssItems = (xml, sourceUrl) =>
  [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match, index) => {
    const raw = match[0]
    const title = raw.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i)
    const link = raw.match(/<link>([\s\S]*?)<\/link>/i)
    const pubDate = raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)
    const resolvedTitle = title?.[1] ?? title?.[2]
    const resolvedLink = stripTags(link?.[1] ?? sourceUrl)
    return {
      id: resolvedLink || `${sourceUrl}-${index}`,
      title: resolvedTitle,
      url: resolvedLink || sourceUrl,
      pubDate: pubDate?.[1] ? new Date(stripTags(pubDate[1])).getTime() : undefined,
    }
  })

// ─── newsnow proxy ─────────────────────────────────────────────────────────────
// Maps our source IDs to newsnow source IDs (most are identical; override here if
// they diverge). Returns normalized items ready for normalizeItems().
const NEWSNOW_ID_MAP = {
  hackernews: 'hackernews',
  github: 'github',
  weibo: 'weibo',
  baidu: 'baidu',
  '36kr': '36kr',
  bilibili: 'bilibili',
  douyin: 'douyin',
  v2ex: 'v2ex',
  juejin: 'juejin',
  jin10: 'jin10',
  gelonghui: 'gelonghui',
  producthunt: 'producthunt',
  ithome: 'ithome',
  sspai: 'sspai',
  toutiao: 'toutiao',
  zhihu: 'zhihu',
}

const fetchFromNewsnow = async (id, fetchImpl = fetch) => {
  const newsnowId = NEWSNOW_ID_MAP[id] ?? id
  const res = await fetchJson(`${NEWSNOW_BASE}/api/s/?id=${newsnowId}`, {}, fetchImpl)
  if (!Array.isArray(res?.items)) throw new Error(`newsnow returned no items for "${newsnowId}"`)
  return res.items.map((item) => ({
    id: item.id != null ? String(item.id) : item.url,
    title: item.title,
    url: item.url,
    mobileUrl: item.mobileUrl,
    pubDate: item.pubDate,
    extra: item.extra && typeof item.extra === 'object' ? item.extra : undefined,
  }))
}

export const createDefaultFetchers = (fetchImpl = fetch) => ({
  // ── Sources that have stable direct APIs — keep our own fetchers ────────
  zhihu: async () => {
    const res = await fetchJson('https://www.zhihu.com/api/v3/feed/topstory/hot-list-web?limit=20&desktop=true', {}, fetchImpl)
    return res.data?.map((item) => ({
      id: item.target?.link?.url?.match(/(\d+)$/)?.[1] ?? item.target?.link?.url,
      title: item.target?.title_area?.text,
      url: item.target?.link?.url,
      extra: { info: item.target?.metrics_area?.text, hover: item.target?.excerpt_area?.text },
    }))
  },
  toutiao: async () => {
    const res = await fetchJson('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc', {}, fetchImpl)
    return res.data?.map((item) => ({
      id: item.ClusterIdStr,
      title: item.Title,
      url: `https://www.toutiao.com/trending/${item.ClusterIdStr}/`,
    }))
  },
  hackernews: async () => {
    const res = await fetchJson('https://hn.algolia.com/api/v1/search?tags=front_page', {}, fetchImpl)
    return res.hits?.map((item) => ({
      id: item.objectID,
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
      extra: { info: `${item.points ?? 0} points` },
    }))
  },
  ithome: async () => parseRssItems(await fetchText('https://www.ithome.com/rss/', {}, fetchImpl), 'https://www.ithome.com/'),
  sspai: async () => {
    const res = await fetchJson(`https://sspai.com/api/v1/article/tag/page/get?limit=30&offset=0&created_at=${Date.now()}&tag=%E7%83%AD%E9%97%A8%E6%96%87%E7%AB%A0&released=false`, {}, fetchImpl)
    return res.data?.map((item) => ({ id: item.id, title: item.title, url: `https://sspai.com/post/${item.id}` }))
  },
  wallstreetcn: async () => {
    const res = await fetchJson('https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&limit=30', {}, fetchImpl)
    return res.data?.items?.map((item) => ({
      id: item.id,
      title: item.title || item.content_text,
      url: item.uri,
      pubDate: item.display_time ? item.display_time * 1000 : undefined,
    }))
  },
  cls: async () => {
    const res = await fetchJson('https://www.cls.cn/nodeapi/updateTelegraphList', {}, fetchImpl)
    return res.data?.roll_data?.filter((item) => !item.is_ad).map((item) => ({
      id: item.id,
      title: item.title || item.brief,
      url: `https://www.cls.cn/detail/${item.id}`,
      mobileUrl: item.shareurl,
      pubDate: item.ctime ? item.ctime * 1000 : undefined,
    }))
  },
  xueqiu: async () => {
    const res = await fetchJson('https://stock.xueqiu.com/v5/stock/hot_stock/list.json?size=30&_type=10&type=10', {}, fetchImpl)
    return res.data?.items?.filter((item) => !item.ad).map((item) => ({
      id: item.code,
      title: item.name,
      url: `https://xueqiu.com/s/${item.code}`,
      extra: { info: `${item.percent}% ${item.exchange}` },
    }))
  },

  // ── Sources routed through newsnow (fragile scrapers replaced) ──────────
  weibo:       async () => fetchFromNewsnow('weibo', fetchImpl),
  baidu:       async () => fetchFromNewsnow('baidu', fetchImpl),
  github:      async () => fetchFromNewsnow('github', fetchImpl),
  '36kr':      async () => fetchFromNewsnow('36kr', fetchImpl),
  bilibili:    async () => fetchFromNewsnow('bilibili', fetchImpl),
  douyin:      async () => fetchFromNewsnow('douyin', fetchImpl),
  producthunt: async () => fetchFromNewsnow('producthunt', fetchImpl),
  v2ex:        async () => fetchFromNewsnow('v2ex', fetchImpl),
  juejin:      async () => fetchFromNewsnow('juejin', fetchImpl),
  jin10:       async () => fetchFromNewsnow('jin10', fetchImpl),
  gelonghui:   async () => fetchFromNewsnow('gelonghui', fetchImpl),
  xiaoheihe: async () => {
    const res = await fetchJson('https://api.xiaoheihe.cn/bbs/web/home/banner', {}, fetchImpl)
    return res.result?.banner?.map((item) => ({
      id: String(item.linkid),
      title: item.title,
      url: `https://xiaoheihe.cn/h/${item.linkid}`,
      pubDate: item.timestamp ? item.timestamp * 1000 : undefined,
      extra: { info: [item.author?.username, item.topic?.name].filter(Boolean).join(' · ') || undefined },
    }))
  },
})

const readCache = (db, sourceId) => {
  const row = db.prepare('SELECT source_id, updated_at, items_json FROM news_cache WHERE source_id = ?').get(sourceId)
  if (!row) return null
  try {
    return {
      id: row.source_id,
      updatedAt: row.updated_at,
      items: JSON.parse(row.items_json),
    }
  } catch {
    return null
  }
}

const writeCache = (db, sourceId, updatedAt, items) => {
  db.prepare(`
    INSERT INTO news_cache (source_id, updated_at, items_json)
    VALUES (?, ?, ?)
    ON CONFLICT(source_id) DO UPDATE SET updated_at = excluded.updated_at, items_json = excluded.items_json
  `).run(sourceId, updatedAt, JSON.stringify(items))
}

export const createNewsService = ({
  db,
  fetchers = createDefaultFetchers(),
  now = () => Date.now(),
  ttlMs = DEFAULT_TTL_MS,
} = {}) => {
  if (!db) throw new Error('News service requires a database')
  ensureNewsTables(db)

  const getSources = () => Object.values(NEWS_SOURCES)

  const getSource = async ({ id, latest = false } = {}) => {
    const source = NEWS_SOURCES[id]
    const fetcher = fetchers[id]
    if (!source || typeof fetcher !== 'function') {
      const error = new Error('Invalid source id')
      error.statusCode = 400
      throw error
    }

    const timestamp = now()
    const cache = readCache(db, id)
    if (cache && timestamp - cache.updatedAt < source.interval) {
      return { status: 'cache', id, updatedTime: cache.updatedAt, items: cache.items }
    }
    if (cache && !latest && timestamp - cache.updatedAt < ttlMs) {
      return { status: 'cache', id, updatedTime: cache.updatedAt, items: cache.items }
    }

    try {
      const items = normalizeItems(await fetcher())
      if (!items.length) throw new Error('Source returned no stories')
      writeCache(db, id, timestamp, items)
      return { status: 'success', id, updatedTime: timestamp, items }
    } catch (error) {
      if (cache) {
        return { status: 'cache', id, updatedTime: cache.updatedAt, items: cache.items, warning: error.message }
      }
      throw error
    }
  }

  const refreshSources = async (ids) => {
    const sourceIds = Array.isArray(ids) && ids.length ? ids : Object.keys(NEWS_SOURCES)
    const results = []
    for (const id of sourceIds) {
      try {
        results.push(await getSource({ id, latest: true }))
      } catch (error) {
        results.push({ status: 'error', id, error: error.message })
      }
    }
    return { results }
  }

  return { getSources, getSource, refreshSources }
}
