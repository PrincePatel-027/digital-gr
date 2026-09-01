import { afterEach, describe, expect, it } from 'vitest'
import { toParsedRecord } from './extract-shared'
import {
  mergeVoiceGroups,
  reconcileCount,
  runMultiVoicePipeline,
  runVoicePipeline,
  VoicePipelineError,
  type MultiVoiceRunner,
  type VoiceRunner,
} from './voice-pipeline'

const audio = Buffer.from('audio')

afterEach(() => {
  delete process.env.VOICE_EXTRACTOR_ORDER
  delete process.env.VOICE_MAX_ENTRIES
})

describe('partial voice mapping', () => {
  it('keeps an admission-only group high-confidence before merge', () => {
    const record = toParsedRecord({
      admission_date: '2024-06-06',
      admission_standard: '1',
    }, 'high', {
      allowedFields: ['admission_date', 'admission_standard', 'previous_school'],
      requireIdentity: false,
      downgradeAdmissionLeavingAmbiguity: false,
    })

    expect(record?.admission_date).toEqual({ value: '2024-06-06', confidence: 'high' })
    expect(record?.admission_standard).toEqual({ value: '1', confidence: 'high' })
  })

  it('does not drop a useful group with no name or GR number', () => {
    const record = toParsedRecord({ previous_school: 'Sunrise Primary School' }, 'high', {
      allowedFields: ['admission_date', 'admission_standard', 'previous_school'],
      requireIdentity: false,
      downgradeAdmissionLeavingAmbiguity: false,
    })

    expect(record).toEqual({
      previous_school: { value: 'Sunrise Primary School', confidence: 'high' },
    })
  })
})

describe('runVoicePipeline', () => {
  it('uses first non-empty result, accumulates earlier warnings, and pins names medium', async () => {
    const runners: Record<string, VoiceRunner> = {
      empty: {
        available: true,
        run: async () => ({
          mode: 'single',
          transcript: '',
          fields: {},
          model: 'empty-model',
          error: 'provider unavailable',
        }),
      },
      success: {
        available: true,
        run: async () => ({
          mode: 'single',
          transcript: 'Student Jagdish Dixit.',
          fields: {
            student_name: { value: 'Jagdish', confidence: 'high' },
            surname: { value: 'Dixit', confidence: 'high' },
          },
          model: 'working-model',
        }),
      },
    }

    const result = await runVoicePipeline(audio, 'audio/webm', 'identity', 'en-IN', {
      order: ['missing', 'empty', 'success'],
      runners,
    })

    expect(result.mode).toBe('single')
    expect(result.source).toBe('success')
    expect(result.fields.student_name?.confidence).toBe('medium')
    expect(result.fields.surname?.confidence).toBe('medium')
    expect(result.warning).toBe(
      'missing: extractor is not registered | empty: provider unavailable'
    )
  })

  it('throws a real pipeline error when every extractor fails', async () => {
    const runners: Record<string, VoiceRunner> = {
      failed: {
        available: true,
        run: async () => ({
          mode: 'single',
          transcript: '',
          fields: {},
          model: 'failed-model',
          error: 'quota exhausted',
        }),
      },
    }

    await expect(runVoicePipeline(audio, 'audio/webm', 'identity', 'en-IN', {
      order: ['failed'],
      runners,
    })).rejects.toEqual(expect.objectContaining<Partial<VoicePipelineError>>({
      name: 'VoicePipelineError',
      message: 'Voice extraction failed: failed: quota exhausted',
    }))
  })
})

describe('runMultiVoicePipeline', () => {
  it('returns all actual students, pins names medium, and warns without coercing count', async () => {
    const runners: Record<string, MultiVoiceRunner> = {
      empty: {
        available: true,
        run: async () => ({
          mode: 'multi',
          transcript: '',
          students: [],
          model: 'empty-model',
          error: 'temporarily unavailable',
        }),
      },
      success: {
        available: true,
        run: async () => ({
          mode: 'multi',
          transcript: 'Three complete student entries.',
          students: [
            {
              gr_number: { value: '42', confidence: 'high' },
              student_name: { value: 'Jagdish', confidence: 'high' },
            },
            {
              gr_number: { value: '43', confidence: 'high' },
              student_name: { value: 'Mira', confidence: 'high' },
            },
            {
              gr_number: { value: '44', confidence: 'high' },
              student_name: { value: 'Jay', confidence: 'high' },
            },
          ],
          model: 'working-model',
        }),
      },
    }

    const result = await runMultiVoicePipeline(audio, 'audio/webm', 4, 'en-IN', {
      order: ['empty', 'success'],
      runners,
    })

    expect(result.mode).toBe('multi')
    expect(result.students).toHaveLength(3)
    expect(result.students.every((record) => record.student_name?.confidence === 'medium')).toBe(true)
    expect(result.warning).toBe(
      'empty: temporarily unavailable | You expected 4 entries, I found 3. Review before saving.'
    )
  })

  it('reports total multi-provider failure as a real error', async () => {
    const runners: Record<string, MultiVoiceRunner> = {
      empty: {
        available: true,
        run: async () => ({
          mode: 'multi',
          transcript: 'Speech was heard.',
          students: [],
          model: 'empty-model',
        }),
      },
    }

    await expect(runMultiVoicePipeline(audio, 'audio/webm', null, 'en-IN', {
      order: ['empty'],
      runners,
    })).rejects.toEqual(expect.objectContaining<Partial<VoicePipelineError>>({
      name: 'VoicePipelineError',
      message: 'Multi-entry voice extraction failed: empty: no student records extracted',
    }))
  })

  it('reconciles count only as a warning', () => {
    expect(reconcileCount(null, 3)).toBeNull()
    expect(reconcileCount(3, 3)).toBeNull()
    expect(reconcileCount(4, 3)).toBe(
      'You expected 4 entries, I found 3. Review before saving.'
    )
  })
})

describe('mergeVoiceGroups', () => {
  it('uses the later value when a group is re-recorded and accumulates warnings', () => {
    const merged = mergeVoiceGroups([
      {
        group: 'identity',
        fields: { student_name: { value: 'Old', confidence: 'high' } },
        warning: 'first warning',
      },
      {
        group: 'identity',
        fields: { student_name: { value: 'Jagdish', confidence: 'high' } },
        warning: 'second warning',
      },
    ])

    expect(merged.fields.student_name).toEqual({ value: 'Jagdish', confidence: 'medium' })
    expect(merged.warning).toBe('first warning | second warning')
  })

  it('runs admission/leaving ambiguity sanitation once after all groups merge', () => {
    const merged = mergeVoiceGroups([
      {
        group: 'admission',
        fields: {
          admission_date: { value: '2024-06-06', confidence: 'high' },
          admission_standard: { value: '1', confidence: 'high' },
        },
      },
      {
        group: 'leaving-notes',
        fields: {
          leaving_date: { value: '2026-03-31', confidence: 'high' },
          leaving_standard: { value: '3', confidence: 'high' },
        },
      },
    ])

    expect(merged.fields.admission_date?.confidence).toBe('high')
    expect(merged.fields.leaving_date?.confidence).toBe('high')
    expect(merged.fields.admission_standard?.confidence).toBe('high')
    expect(merged.fields.leaving_standard?.confidence).toBe('high')
  })
})
