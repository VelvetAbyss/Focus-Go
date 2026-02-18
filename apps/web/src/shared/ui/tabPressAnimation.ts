const TAB_PRESS_CLASS = 'is-pressing'
const TAB_SWITCHING_CLASS = 'is-tab-switching'

const shouldReduceMotion = () =>
  document.documentElement.getAttribute('data-motion') === 'reduce' ||
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const triggerTabPressAnimation = (tab: HTMLElement) => {
  if (shouldReduceMotion()) return

  tab.classList.remove(TAB_PRESS_CLASS)
  window.requestAnimationFrame(() => {
    tab.classList.add(TAB_PRESS_CLASS)
  })

  tab.addEventListener(
    'animationend',
    () => {
      tab.classList.remove(TAB_PRESS_CLASS)
    },
    { once: true }
  )
}

export const triggerTabGroupSwitchAnimation = (tab: HTMLElement) => {
  if (shouldReduceMotion()) return

  const group = tab.closest<HTMLElement>('[role="tablist"].tab-motion-group')
  if (!group) return

  group.classList.remove(TAB_SWITCHING_CLASS)
  window.requestAnimationFrame(() => {
    group.classList.add(TAB_SWITCHING_CLASS)
  })

  group.addEventListener(
    'animationend',
    () => {
      group.classList.remove(TAB_SWITCHING_CLASS)
    },
    { once: true }
  )
}
