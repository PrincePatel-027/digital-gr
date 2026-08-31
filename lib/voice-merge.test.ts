import { describe, expect, it } from 'vitest'
import { buildSpokenAuditText } from './voice-merge'
import type { VoiceEntryResponse } from './voice-types'

function result(
  group: VoiceEntryResponse['group'],
  transcript: string
): VoiceEntryResponse {
  return {
    group,
    language: 'en-IN',
    transcript,
    fields: {},
    source: 'gemini-audio',
    model: 'gemini-test',
    warning: null,
    error: null,
  }
}

describe('buildSpokenAuditText', () => {
  it('writes stable group headers in register order and replaces a re-recorded take', () => {
    const results = {
      admission: result('admission', 'Admitted in standard one.'),
      identity: result('identity', 'Student Jagdish Dixit.'),
    }

    expect(buildSpokenAuditText(results)).toBe(
      '===== SPOKEN (Identity) =====\nStudent Jagdish Dixit.\n\n' +
      '===== SPOKEN (Admission) =====\nAdmitted in standard one.'
    )

    results.identity = result('identity', 'Student Jagdish Ramesh Dixit.')
    expect(buildSpokenAuditText(results)).toContain(
      '===== SPOKEN (Identity) =====\nStudent Jagdish Ramesh Dixit.'
    )
    expect(buildSpokenAuditText(results)).not.toContain('Student Jagdish Dixit.')
  })
})
