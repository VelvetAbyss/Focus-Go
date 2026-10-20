import { mergeAttributes, Node } from '@tiptap/core'

/** The persisted upload placeholder is shared by the editor and CRDT codec.
 * Keep this definition free of React views and upload side effects. */
export const ImageUploadSchema = Node.create<{ accept: string; limit: number; maxSize: number }>({
  name: 'imageUpload',
  group: 'block',
  draggable: true,
  selectable: true,
  atom: true,
  addOptions() {
    return { accept: 'image/*', limit: 1, maxSize: 0 }
  },
  addAttributes() {
    return {
      accept: { default: this.options.accept },
      limit: { default: this.options.limit },
      maxSize: { default: this.options.maxSize },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="image-upload"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'image-upload' }, HTMLAttributes)]
  },
})
