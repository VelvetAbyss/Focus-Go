/** Selectors for <ActiveIndicator selector=…>, relative to the control's container. */

/** role="tab" children (tab bars, segmented pickers). */
export const SELECTED_TAB = ':scope > [role="tab"][aria-selected="true"]'

/** Toggle-button groups (aria-pressed). */
export const PRESSED_BUTTON = ':scope > [aria-pressed="true"]'

/** Class-driven controls. */
export const IS_ACTIVE = ':scope > .is-active'
