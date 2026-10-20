const PREPARE_UPDATE_EVENT = 'focusgo:prepare-update'
type UpdatePreparation = { waitUntil: (promise: Promise<unknown>) => void }

/** Editors synchronously flush keystrokes; repositories may then await local saves. */
export const onPrepareAppUpdate = (prepare: () => void | Promise<unknown>) => {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<UpdatePreparation>).detail
    try { detail.waitUntil(Promise.resolve(prepare())) }
    catch (error) { detail.waitUntil(Promise.reject(error)) }
  }
  window.addEventListener(PREPARE_UPDATE_EVENT, listener)
  return () => window.removeEventListener(PREPARE_UPDATE_EVENT, listener)
}

export const prepareAppUpdate = async () => {
  const writes: Promise<unknown>[] = []
  window.dispatchEvent(new CustomEvent<UpdatePreparation>(PREPARE_UPDATE_EVENT, {
    detail: { waitUntil: promise => writes.push(promise) },
  }))
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.all(writes),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Local save is still pending')), 5000) }),
    ])
  } finally { clearTimeout(timer) }
}
