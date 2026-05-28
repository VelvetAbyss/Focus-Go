const DEFAULT_TTL_MS = 30 * 60 * 1000
const DEFAULT_LIMIT = 30

// Public newsnow API — used for sources whose direct scrapers are fragile.
// newsnow team maintains the scrapers; we just proxy + cache.
const NEWSNOW_BASE = 'https://newsnow.busiyi.world'

const requestHeaders = {
  'user-agent': 'Mozilla/5.0 FocusGoNews/1.0 (+https://nestflow.art)',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
}

const rssSource = ({ id, name, category, type = 'realtime', interval = 10 * 60 * 1000, home, feedUrl, accent, language = 'en', region = 'global' }) => ({
  id,
  name,
  category,
  type,
  interval,
  home,
  feedUrl,
  accent,
  language,
  region,
})

const OFFICIAL_RSS_SOURCES = {
  // ── International ───────────────────────────────────────────────────────
  bbc_top: rssSource({ id: 'bbc_top', name: 'BBC Top Stories', category: 'world', home: 'https://www.bbc.com/news', feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml', accent: '#8b2f3c', region: 'uk' }),
  bbc_world: rssSource({ id: 'bbc_world', name: 'BBC World', category: 'world', home: 'https://www.bbc.com/news/world', feedUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml', accent: '#8b2f3c', region: 'global' }),
  guardian_world: rssSource({ id: 'guardian_world', name: 'The Guardian World', category: 'world', home: 'https://www.theguardian.com/world', feedUrl: 'https://www.theguardian.com/world/rss', accent: '#345c7d', region: 'uk' }),
  npr_news: rssSource({ id: 'npr_news', name: 'NPR News', category: 'world', home: 'https://www.npr.org/sections/news/', feedUrl: 'https://feeds.npr.org/1001/rss.xml', accent: '#b5533b', region: 'us' }),
  nyt_world: rssSource({ id: 'nyt_world', name: 'NYTimes World', category: 'world', home: 'https://www.nytimes.com/section/world', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', accent: '#3A3733', region: 'us' }),
  france24_en: rssSource({ id: 'france24_en', name: 'France24 English', category: 'world', home: 'https://www.france24.com/en/', feedUrl: 'https://www.france24.com/en/rss', accent: '#5f6f9d', region: 'france' }),
  france24_fr: rssSource({ id: 'france24_fr', name: 'France24 Français', category: 'world', home: 'https://www.france24.com/fr/', feedUrl: 'https://www.france24.com/fr/rss', accent: '#5f6f9d', language: 'fr', region: 'france' }),
  aljazeera_en: rssSource({ id: 'aljazeera_en', name: 'Al Jazeera English', category: 'world', home: 'https://www.aljazeera.com/', feedUrl: 'https://www.aljazeera.com/xml/rss/all.xml', accent: '#9a6a2f', region: 'global' }),
  cnn_top: rssSource({ id: 'cnn_top', name: 'CNN Top Stories', category: 'world', home: 'https://edition.cnn.com/', feedUrl: 'http://rss.cnn.com/rss/edition.rss', accent: '#b93d35', region: 'us' }),
  cnn_world: rssSource({ id: 'cnn_world', name: 'CNN World', category: 'world', home: 'https://edition.cnn.com/world', feedUrl: 'http://rss.cnn.com/rss/edition_world.rss', accent: '#b93d35', region: 'us' }),
  dw_top: rssSource({ id: 'dw_top', name: 'DW Top Stories', category: 'world', home: 'https://www.dw.com/en/top-stories/s-9097', feedUrl: 'https://rss.dw.com/xml/rss-en-all', accent: '#53729a', region: 'germany' }),
  dw_world: rssSource({ id: 'dw_world', name: 'DW World', category: 'world', home: 'https://www.dw.com/en/world/s-1429', feedUrl: 'https://rss.dw.com/xml/rss-en-world', accent: '#53729a', region: 'germany' }),
  nhk_world: rssSource({ id: 'nhk_world', name: 'NHK World', category: 'world', home: 'https://www3.nhk.or.jp/nhkworld/', feedUrl: 'https://www3.nhk.or.jp/rss/news/cat0.xml', accent: '#6c7d8c', region: 'japan' }),
  japantimes: rssSource({ id: 'japantimes', name: 'The Japan Times', category: 'world', home: 'https://www.japantimes.co.jp/', feedUrl: 'https://www.japantimes.co.jp/feed/', accent: '#8a4e4b', region: 'japan' }),
  scmp: rssSource({ id: 'scmp', name: 'SCMP', category: 'world', home: 'https://www.scmp.com/news', feedUrl: 'https://www.scmp.com/rss/91/feed', accent: '#8a6b36', region: 'hong-kong' }),
  straits_times: rssSource({ id: 'straits_times', name: 'The Straits Times World', category: 'world', home: 'https://www.straitstimes.com/world', feedUrl: 'https://www.straitstimes.com/news/world/rss.xml', accent: '#4e6d88', region: 'singapore' }),
  cbc_top: rssSource({ id: 'cbc_top', name: 'CBC Top Stories', category: 'world', home: 'https://www.cbc.ca/news', feedUrl: 'https://www.cbc.ca/cmlink/rss-topstories', accent: '#b84a3a', region: 'canada' }),
  abc_au: rssSource({ id: 'abc_au', name: 'ABC Australia', category: 'world', home: 'https://www.abc.net.au/news/', feedUrl: 'https://www.abc.net.au/news/feed/51120/rss.xml', accent: '#537f6b', region: 'australia' }),
  skynews_world: rssSource({ id: 'skynews_world', name: 'Sky News World', category: 'world', home: 'https://news.sky.com/world', feedUrl: 'https://feeds.skynews.com/feeds/rss/world.xml', accent: '#8a4e4b', region: 'uk' }),
  independent_world: rssSource({ id: 'independent_world', name: 'The Independent World', category: 'world', home: 'https://www.independent.co.uk/news/world', feedUrl: 'https://www.independent.co.uk/news/world/rss', accent: '#4e6d88', region: 'uk' }),
  hindu_world: rssSource({ id: 'hindu_world', name: 'The Hindu International', category: 'world', home: 'https://www.thehindu.com/news/international/', feedUrl: 'https://www.thehindu.com/news/international/feeder/default.rss', accent: '#8a6b36', region: 'india' }),
  ndtv_world: rssSource({ id: 'ndtv_world', name: 'NDTV World', category: 'world', home: 'https://www.ndtv.com/world-news', feedUrl: 'https://feeds.feedburner.com/ndtvnews-world-news', accent: '#5a7a8a', region: 'india' }),

  // ── Foreign Tech ────────────────────────────────────────────────────────
  bbc_tech: rssSource({ id: 'bbc_tech', name: 'BBC Technology', category: 'tech', home: 'https://www.bbc.com/news/technology', feedUrl: 'https://feeds.bbci.co.uk/news/technology/rss.xml', accent: '#8b2f3c', region: 'uk' }),
  bbc_science: rssSource({ id: 'bbc_science', name: 'BBC Science', category: 'tech', home: 'https://www.bbc.com/news/science_and_environment', feedUrl: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', accent: '#8b2f3c', region: 'uk' }),
  guardian_tech: rssSource({ id: 'guardian_tech', name: 'The Guardian Technology', category: 'tech', home: 'https://www.theguardian.com/technology', feedUrl: 'https://www.theguardian.com/technology/rss', accent: '#345c7d', region: 'uk' }),
  nyt_tech: rssSource({ id: 'nyt_tech', name: 'NYTimes Technology', category: 'tech', home: 'https://www.nytimes.com/section/technology', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', accent: '#3A3733', region: 'us' }),
  techcrunch: rssSource({ id: 'techcrunch', name: 'TechCrunch', category: 'tech', home: 'https://techcrunch.com/', feedUrl: 'https://techcrunch.com/feed/', accent: '#4f8c53', region: 'us' }),
  theverge: rssSource({ id: 'theverge', name: 'The Verge', category: 'tech', home: 'https://www.theverge.com/', feedUrl: 'https://www.theverge.com/rss/index.xml', accent: '#7d4d87', region: 'us' }),
  arstechnica: rssSource({ id: 'arstechnica', name: 'Ars Technica', category: 'tech', home: 'https://arstechnica.com/', feedUrl: 'https://feeds.arstechnica.com/arstechnica/index', accent: '#c77a32', region: 'us' }),
  wired: rssSource({ id: 'wired', name: 'WIRED', category: 'tech', home: 'https://www.wired.com/', feedUrl: 'https://www.wired.com/feed/rss', accent: '#3A3733', region: 'us' }),
  engadget: rssSource({ id: 'engadget', name: 'Engadget', category: 'tech', home: 'https://www.engadget.com/', feedUrl: 'https://www.engadget.com/rss.xml', accent: '#7d4d87', region: 'us' }),

  // ── Foreign Finance ────────────────────────────────────────────────────
  bbc_business: rssSource({ id: 'bbc_business', name: 'BBC Business', category: 'finance', home: 'https://www.bbc.com/news/business', feedUrl: 'https://feeds.bbci.co.uk/news/business/rss.xml', accent: '#8b2f3c', region: 'uk' }),
  guardian_business: rssSource({ id: 'guardian_business', name: 'The Guardian Business', category: 'finance', home: 'https://www.theguardian.com/business', feedUrl: 'https://www.theguardian.com/business/rss', accent: '#345c7d', region: 'uk' }),
  nyt_business: rssSource({ id: 'nyt_business', name: 'NYTimes Business', category: 'finance', home: 'https://www.nytimes.com/section/business', feedUrl: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', accent: '#3A3733', region: 'us' }),
  cnbc_business: rssSource({ id: 'cnbc_business', name: 'CNBC Business', category: 'finance', home: 'https://www.cnbc.com/business/', feedUrl: 'https://www.cnbc.com/id/10001147/device/rss/rss.html', accent: '#4e6d88', region: 'us' }),
  cnbc_world: rssSource({ id: 'cnbc_world', name: 'CNBC World', category: 'finance', home: 'https://www.cnbc.com/world/', feedUrl: 'https://www.cnbc.com/id/100727362/device/rss/rss.html', accent: '#4e6d88', region: 'us' }),
  marketwatch_top: rssSource({ id: 'marketwatch_top', name: 'MarketWatch Top Stories', category: 'finance', home: 'https://www.marketwatch.com/', feedUrl: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', accent: '#537f6b', region: 'us' }),
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
  ...OFFICIAL_RSS_SOURCES,
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
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))

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

const readXmlTag = (xml, tagName) => {
  const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  if (!match) return undefined
  return stripTags(match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, '$1'))
}

const parseRssItems = (xml, sourceUrl) =>
  [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match, index) => {
    const raw = match[0]
    const resolvedTitle = readXmlTag(raw, 'title')
    const resolvedLink = readXmlTag(raw, 'link') || readXmlTag(raw, 'guid') || sourceUrl
    const pubDate = readXmlTag(raw, 'pubDate') || readXmlTag(raw, 'dc:date') || readXmlTag(raw, 'updated')
    const pubTime = pubDate ? new Date(pubDate).getTime() : undefined
    return {
      id: resolvedLink || `${sourceUrl}-${index}`,
      title: resolvedTitle,
      url: resolvedLink || sourceUrl,
      pubDate: Number.isFinite(pubTime) ? pubTime : undefined,
    }
  })

export const fetchRssFeed = async (feedUrl, homeUrl, fetchImpl = fetch) =>
  parseRssItems(await fetchText(feedUrl, {}, fetchImpl), homeUrl)

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
  ...Object.fromEntries(
    Object.values(OFFICIAL_RSS_SOURCES).map((source) => [
      source.id,
      async () => fetchRssFeed(source.feedUrl, source.home, fetchImpl),
    ]),
  ),
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
