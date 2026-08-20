const IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*\]\([^)]+\)/g

export const stripImageMarkdown = (content: string) => content.replace(IMAGE_MARKDOWN_PATTERN, '')

export const countWordsInMarkdown = (content: string) => {
  const tokens = stripImageMarkdown(content).match(/[\p{Script=Han}]|[A-Za-z0-9]+/gu)
  return tokens?.length ?? 0
}

export const countCharactersInMarkdown = (content: string) => stripImageMarkdown(content).length

export const countCharactersNoSpacesInMarkdown = (content: string) => stripImageMarkdown(content).replace(/\s+/g, '').length
