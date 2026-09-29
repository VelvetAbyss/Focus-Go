import { describe, expect, it } from 'vitest'
import { BEAD_RADIUS, packJar, packJarWithin, pileTop } from './beadPacking'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `task-${i}`)

describe('beadPacking', () => {
  it('packs the same week the same way every time', () => {
    const a = packJar('2026-09-28', ids(20)).map((bead) => bead.position)
    const b = packJar('2026-09-28', ids(20)).map((bead) => bead.position)
    expect(a).toEqual(b)
  })

  it('never moves a bead when more land on top', () => {
    const first = packJar('2026-09-28', ids(12)).map((bead) => bead.position)
    const more = packJar('2026-09-28', ids(18)).map((bead) => bead.position)
    expect(more.slice(0, 12)).toEqual(first)
  })

  it('keeps beads inside the jar, on the floor or on each other, without overlapping', () => {
    const beads = packJar('2026-09-21', ids(40))
    const positions = beads.map((bead) => bead.position)
    for (const [x, y, z] of positions) {
      expect(Math.hypot(x, z) + BEAD_RADIUS).toBeLessThanOrEqual(1.01)
      expect(y).toBeGreaterThanOrEqual(BEAD_RADIUS - 1e-6)
    }
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const d = Math.hypot(positions[i][0] - positions[j][0], positions[i][1] - positions[j][1], positions[i][2] - positions[j][2])
        expect(d).toBeGreaterThan(2 * BEAD_RADIUS - 0.01)
      }
    }
  })

  it('records a fall that ends where the bead rests', () => {
    const [bead] = packJar('2026-09-28', ['only'])
    expect(bead.path[bead.path.length - 1]).toEqual(bead.position)
    expect(bead.path[0][1]).toBeGreaterThan(bead.position[1])
    expect(bead.contactIndex).toBeGreaterThan(0)
  })

  it('shrinks the beads so a very heavy week still fits', () => {
    const { beads, radius } = packJarWithin('2026-09-28', ids(120), 3)
    expect(radius).toBeLessThan(BEAD_RADIUS)
    expect(pileTop(beads.map((bead) => bead.position), radius)).toBeLessThanOrEqual(3.15)
  })
})
