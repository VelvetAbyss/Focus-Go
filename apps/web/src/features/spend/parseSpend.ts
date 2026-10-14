/**
 * "午饭 28", "28 打车", "$12 coffee", "¥35.5": the amount, an optional currency mark, and the
 * words, which name the category and become the entry's note.
 */
export type ParsedSpend = { amount: number; currency?: 'CNY' | 'USD'; note: string }

const AMOUNT = /([$¥￥])?\s*(\d+(?:[.,]\d{1,2})?)\s*(元|块|rmb|cny|usd|美元|刀)?/i

export const parseSpendInput = (raw: string): ParsedSpend | null => {
  const text = raw.trim()
  const match = AMOUNT.exec(text)
  if (!match) return null
  const amount = Number(match[2].replace(',', '.'))
  if (!(amount > 0)) return null
  const mark = (match[1] ?? '') + (match[3] ?? '').toLowerCase()
  const currency = /\$|usd|美元|刀/.test(mark) ? 'USD' : /[¥￥]|元|块|rmb|cny/.test(mark) ? 'CNY' : undefined
  const note = (text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length)).replace(/\s+/g, ' ').trim()
  return { amount, currency, note }
}

// Words for what was bought, and the category names they belong under.
const GROUPS: Array<{ words: RegExp; names: RegExp }> = [
  { words: /饭|餐|吃|外卖|咖啡|奶茶|饮料|零食|水果|菜|面|lunch|dinner|breakfast|coffee|food|meal|snack/i, names: /餐|饭|食|吃|饮|food|meal|dining|eat/i },
  { words: /打车|滴滴|出租|地铁|公交|高铁|火车|机票|油费|加油|停车|过路|taxi|uber|metro|bus|train|flight|fuel|parking/i, names: /交通|出行|车|行|transport|travel|commute|taxi/i },
  { words: /超市|淘宝|京东|拼多多|买|衣服|鞋|日用|shopping|clothes|grocer/i, names: /购物|日用|生活|shop|grocer/i },
  { words: /电影|游戏|ktv|演出|门票|movie|game|ticket/i, names: /娱乐|休闲|fun|entertain/i },
  { words: /房租|水费|电费|燃气|话费|网费|物业|rent|utility|phone bill/i, names: /住|房|居|账单|缴费|rent|home|bill|utilit/i },
  { words: /药|医院|看病|体检|medicine|doctor|hospital/i, names: /医|健康|health|medical/i },
]

/**
 * The category the words point to: one named outright ("交通 12"), else one whose name fits the
 * kind of thing bought ("午饭" → 餐饮), else null (the caller keeps the last one used).
 */
export const matchSpendCategory = <T extends { id: string; name: string }>(note: string, categories: readonly T[]): T | null => {
  if (!note) return null
  const named = categories.find((category) => category.name && note.toLowerCase().includes(category.name.toLowerCase()))
  if (named) return named
  for (const group of GROUPS) {
    if (!group.words.test(note)) continue
    const fit = categories.find((category) => group.names.test(category.name))
    if (fit) return fit
  }
  return null
}
