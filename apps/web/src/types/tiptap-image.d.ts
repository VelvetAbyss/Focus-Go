import '@tiptap/extension-image'

declare module '@tiptap/extension-image' {
  interface SetImageOptions {
    assetId?: string | null
  }
}

