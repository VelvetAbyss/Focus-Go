import { describe, expect, it } from 'vitest'
import { markdownToPreview } from './markdownPreview'

describe('markdownToPreview', () => {
  it('strips block markers inside an already-collapsed excerpt', () => {
    expect(markdownToPreview('# 欢迎 Note 适合记录。 ## 你可以这样用 - 用标题 - 用标签 > 引用')).toBe(
      '欢迎 Note 适合记录。 你可以这样用 用标题 用标签 引用',
    )
  })

  it('drops a leading heading that repeats the title', () => {
    expect(markdownToPreview('# 周会记录\n\n- [ ] 跟进预算\n1. 第一项', '周会记录')).toBe('跟进预算 第一项')
  })

  it('keeps inline text and unwraps emphasis, code and links', () => {
    expect(markdownToPreview('**粗体** 和 *斜体*，`code`，[链接](https://x.y)，![图](a.png)')).toBe('粗体 和 斜体，code，链接，')
  })

  it('leaves hashtags and hyphenated words alone', () => {
    expect(markdownToPreview('标签#工作 well-known 3-5 天')).toBe('标签#工作 well-known 3-5 天')
  })
})
