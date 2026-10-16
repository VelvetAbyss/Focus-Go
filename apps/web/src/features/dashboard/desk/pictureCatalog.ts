export type PicturePreset = {
  id: string; kind: 'window' | 'frame'; zh: string; en: string; author: string; url: string; source: string; license: string
}
export const PICTURE_PRESETS: PicturePreset[] = [
  { id: 'mediterranean', kind: 'window', zh: '地中海 · 蓝色海湾', en: 'Mediterranean · Blue bay', author: 'Jaime Arrieta', source: 'https://unsplash.com/photos/OSzlbMcf9Hg', license: 'Unsplash License' },
  { id: 'nordic', kind: 'window', zh: '北欧 · 湖畔森林', en: 'Nordic · Forest lake', author: 'Herman Aasly', source: 'https://unsplash.com/photos/6o_5C9_3K6E', license: 'Unsplash License' },
  { id: 'city', kind: 'window', zh: '城市 · 天际线', en: 'City · Skyline', author: 'Anders Krøgh Jørgensen', source: 'https://unsplash.com/photos/nHFjUT6ZkAc', license: 'Unsplash License' },
  { id: 'neon', kind: 'window', zh: '赛博朋克 · 霓虹街巷', en: 'Cyberpunk · Neon alley', author: 'Mario Tuzon', source: 'https://unsplash.com/photos/GjDijugwOc4', license: 'Unsplash License' },
  { id: 'monet', kind: 'frame', zh: '莫奈 · 睡莲', en: 'Monet · Water Lilies', author: 'Claude Monet / Art Institute of Chicago', source: 'https://www.artic.edu/artworks/16568', license: 'CC0' },
  { id: 'wave', kind: 'frame', zh: '北斋 · 神奈川冲浪里', en: 'Hokusai · The Great Wave', author: 'Katsushika Hokusai / Art Institute of Chicago', source: 'https://www.artic.edu/artworks/24645', license: 'CC0' },
  { id: 'bedroom', kind: 'frame', zh: '梵高 · 卧室', en: 'Van Gogh · The Bedroom', author: 'Vincent van Gogh / Art Institute of Chicago', source: 'https://www.artic.edu/artworks/28560', license: 'CC0' },
].map(p => ({ ...p, kind: p.kind as 'window' | 'frame', url: '/desk-pictures/' + p.id + '.jpg' }))
