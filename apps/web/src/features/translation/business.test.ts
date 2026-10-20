import { describe, expect, it } from 'vitest'
import { businessSuggestions } from './business'

describe('local business style suggestions', () => {
  it('keeps names, product codes, quantities and decimal prices intact', () => {
    const suggestion = businessSuggestions('Please confirm 152 units of P115-G20Pro at $162.00 by October 22.')[0]
    expect(suggestion.after).toBe('Could you please confirm 152 units of P115-G20Pro at $162.00 by October 22?')
  })
  it('does not turn multiple sentences or a question into one request', () => {
    expect(businessSuggestions('Please confirm the date. We need it tomorrow.')).toEqual([])
    expect(businessSuggestions('Please confirm the date?')).toEqual([])
  })
  it('expands a contraction without dropping negation', () => {
    expect(businessSuggestions("We can't ship on Friday.")[0]).toMatchObject({ before: "We can't", after: 'We cannot' })
  })
})
