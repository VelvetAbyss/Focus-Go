type HeroImageMatch = {
  url: string
  label: string
  query: string
}

const destinationImages: Array<{ keys: string[]; label: string; url: string }> = [
  {
    keys: ['tokyo', 'japan', '東京'],
    label: 'Tokyo, Japan',
    url: 'https://images.unsplash.com/photo-1612977420019-0284a333eefb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  },
  {
    keys: ['paris', 'france'],
    label: 'Paris, France',
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['new york', 'nyc', 'manhattan'],
    label: 'New York City, USA',
    url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['london', 'england', 'uk', 'united kingdom'],
    label: 'London, United Kingdom',
    url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['seoul', 'korea', '首尔', '서울'],
    label: 'Seoul, South Korea',
    url: 'https://images.unsplash.com/photo-1538485399081-7c8b2f0a8f36?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['singapore', '新加坡'],
    label: 'Singapore',
    url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['bangkok', 'thailand', '曼谷'],
    label: 'Bangkok, Thailand',
    url: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['bali', 'indonesia', '巴厘'],
    label: 'Bali, Indonesia',
    url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['rome', 'italy', 'roma'],
    label: 'Rome, Italy',
    url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['barcelona', 'spain'],
    label: 'Barcelona, Spain',
    url: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['sydney', 'australia'],
    label: 'Sydney, Australia',
    url: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['san francisco', 'sf', 'bay area'],
    label: 'San Francisco, USA',
    url: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['new zealand', 'newzealand', 'aotearoa', 'queenstown', 'auckland', 'nz'],
    label: 'New Zealand',
    url: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?auto=format&fit=crop&q=80&w=1600',
  },
  {
    keys: ['iceland', 'reykjavik'],
    label: 'Iceland',
    url: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?auto=format&fit=crop&q=80&w=1600',
  },
]

const fallbackHeroImage = {
  label: 'Travel',
  url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&q=80&w=1600',
}

const normalizeQuery = (value: string) => value.trim().replace(/\s+/g, ' ')

export const buildTripHeroImageQuery = (destination: string, title: string) => {
  const base = normalizeQuery(destination) || normalizeQuery(title.replace(/\btrip\b/gi, ''))
  return base
}

export const resolveTripHeroImage = (destination: string, title: string): HeroImageMatch => {
  const query = buildTripHeroImageQuery(destination, title) || 'travel'
  const haystack = `${destination} ${title}`.toLowerCase()
  const compactHaystack = haystack.replace(/[\s,._-]+/g, '')
  const curated = destinationImages.find((item) =>
    item.keys.some((key) => {
      const normalizedKey = key.toLowerCase()
      return haystack.includes(normalizedKey) || compactHaystack.includes(normalizedKey.replace(/\s+/g, ''))
    }),
  )

  if (curated) {
    return { url: curated.url, label: curated.label, query }
  }

  return { url: fallbackHeroImage.url, label: query || fallbackHeroImage.label, query }
}

export const isBrokenGeneratedHeroImage = (url: string) => url.includes('source.unsplash.com')
