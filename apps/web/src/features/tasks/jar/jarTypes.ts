// Type-only contract between the recap card and the lazily loaded jar scene,
// so the card never pulls three.js into its own chunk.

export type JarSceneWeek = {
  key: string
  /** Task ids in completion order: one bead each. */
  ids: string[]
  sealed: boolean
}

export type JarSceneColors = {
  /** Ink: the beads. Dark in the light theme, pale in the dark one. */
  bead: string
  /** Pencil: the jar's outline and the plank's edge. */
  pencil: string
  /** The paper the card sits on, tinting the glass. */
  paper: string
  /** The plank's top. */
  plank: string
  /** Paper lids on sealed jars. */
  lid: string
  /** Twine under the lids. */
  twine: string
}

export type JarSceneParams = {
  main: JarSceneWeek
  /** Earlier weeks, newest first. */
  shelf: JarSceneWeek[]
  colors: JarSceneColors
  dark: boolean
  /** Main-jar beads from this index on fall in; null draws them at rest. */
  dropFrom: number | null
  /** A shelf jar whose lid settles on as it is sealed; null for none. */
  sealKey: string | null
  /** Bumped for every new animation, so a repeat of the same one still plays. */
  animationId: number
}
