import { describe, expect, it } from 'vitest'
import {
  normalizeSpokenDate,
  normalizeSpokenNumber,
  normalizeSpokenStandard,
  splitSpokenFullName,
  VOICE_FIELD_GROUPS,
} from './voice-fields'

describe('voice field groups', () => {
  it('contains every GR field exactly once', () => {
    const fields = Object.values(VOICE_FIELD_GROUPS).flatMap((group) => [...group.fields])
    expect(fields).toHaveLength(21)
    expect(new Set(fields).size).toBe(21)
  })
})

describe('normalizeSpokenNumber', () => {
  it('parses cardinals and digit-by-digit identifiers', () => {
    expect(normalizeSpokenNumber('one hundred twenty four')).toBe('124')
    expect(normalizeSpokenNumber('one two four seven')).toBe('1247')
  })
})

describe('normalizeSpokenStandard', () => {
  it('normalizes a spoken standard and rejects out-of-range values', () => {
    expect(normalizeSpokenStandard('standard one')).toBe('1')
    expect(normalizeSpokenStandard('class twelve')).toBe('12')
    expect(normalizeSpokenStandard('standard thirteen')).toBeNull()
  })
})

describe('normalizeSpokenDate', () => {
  it('parses ordinal day and cardinal year speech', () => {
    expect(normalizeSpokenDate('sixth January two thousand sixteen')).toBe('2016-01-06')
  })

  it('keeps ambiguous numeric speech day-first', () => {
    expect(normalizeSpokenDate('six one twenty sixteen')).toBe('2016-01-06')
  })

  it('accepts leap days and rejects impossible calendar dates', () => {
    expect(normalizeSpokenDate('twenty ninth February two thousand twenty four')).toBe('2024-02-29')
    expect(normalizeSpokenDate('twenty ninth February two thousand twenty three')).toBeNull()
    expect(normalizeSpokenDate('thirty first April two thousand twenty four')).toBeNull()
  })
})

describe('splitSpokenFullName', () => {
  it('keeps a one-token name as the student name', () => {
    expect(splitSpokenFullName('Jagdish')).toEqual({ student_name: 'Jagdish' })
  })

  it('splits a two-token name into given name and surname', () => {
    expect(splitSpokenFullName('Jagdish Dixit')).toEqual({
      student_name: 'Jagdish',
      surname: 'Dixit',
    })
  })

  it('splits a three-token register name into given, father, and surname', () => {
    expect(splitSpokenFullName('Jagdish Ramesh Dixit')).toEqual({
      student_name: 'Jagdish',
      fathers_name: 'Ramesh',
      surname: 'Dixit',
    })
  })
})
