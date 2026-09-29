// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { diagnosticRoute, readDiagnostics, recordActivation, recordVital } from './diagnostics'
beforeEach(() => sessionStorage.clear())
describe('privacy-safe local diagnostics', () => {
  it('removes entity identifiers and unknown paths', () => {
    expect(diagnosticRoute('/projects/private-project')).toBe('/projects/:id')
    expect(diagnosticRoute('/trips/private-trip')).toBe('/trips/:id')
    expect(diagnosticRoute('/private-token')).toBe('/other')
  })
  it('allows only numeric web vitals and caps retained entries', () => {
    recordVital({ name: 'secret-body', value: 1, rating: 'good' })
    recordVital({ name: 'LCP', value: NaN, rating: 'good' })
    expect(readDiagnostics()).toHaveLength(0)
    for (let i = 0; i < 120; i++) recordActivation('first_focus_started')
    expect(readDiagnostics()).toHaveLength(100)
    recordVital({ name: 'LCP', value: 250, rating: 'good' })
    expect(readDiagnostics().at(-1)).toMatchObject({ event: 'LCP', value: 250 })
  })
})
