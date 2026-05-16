export const getPastedImageFiles = (event: ClipboardEvent): File[] =>
  Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))

export const getDroppedImageFiles = (event: DragEvent): File[] => {
  const items = event.dataTransfer?.items
  if (items && items.length > 0) {
    const files: File[] = []
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) return files
  }
  return Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'))
}
