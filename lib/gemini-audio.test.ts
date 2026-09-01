import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractVoice, extractVoiceFields } from './gemini-audio'

function responseWithModelJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
  }), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  delete process.env.GEMINI_API_KEY
})

describe('extractVoiceFields', () => {
  it('returns one transcript and group-scoped ParsedGRFields from one request', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue(responseWithModelJson({
      transcript: 'GR number one two four seven. Student Jagdish Dixit.',
      fields: {
        gr_number: 'one two four seven',
        student_name: 'Jagdish Dixit',
        fathers_name: '',
        mothers_name: '',
        surname: '',
        admission_date: 'should never escape this group',
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await extractVoiceFields(
      Buffer.from('webm-audio'),
      'audio/webm',
      'identity',
      { model: 'gemini-test', attempts: 1 }
    )

    expect(result).toEqual({
      mode: 'single',
      transcript: 'GR number one two four seven. Student Jagdish Dixit.',
      model: 'gemini-test',
      fields: {
        gr_number: { value: '1247', confidence: 'high' },
        student_name: { value: 'Jagdish', confidence: 'high' },
        surname: { value: 'Dixit', confidence: 'high' },
      },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(Object.keys(request.generationConfig.responseSchema.properties.fields.properties)).toEqual([
      'gr_number', 'student_name', 'fathers_name', 'mothers_name', 'surname',
    ])
    expect(request.contents[0].parts[0].inline_data.mime_type).toBe('audio/webm')
  })

  it('reports a non-retryable 400 response', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad audio', { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await extractVoiceFields(Buffer.from('bad'), 'audio/webm', 'identity')

    expect(result.error).toContain('Gemini audio returned 400: bad audio')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a 429 and returns the successful second response', async () => {
    vi.useFakeTimers()
    process.env.GEMINI_API_KEY = 'test-key'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
      .mockResolvedValueOnce(responseWithModelJson({
        transcript: 'Admitted sixth June two thousand twenty four in standard one.',
        fields: {
          admission_date: 'sixth June two thousand twenty four',
          admission_standard: 'standard one',
          previous_school: '',
        },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const pending = extractVoiceFields(Buffer.from('audio'), 'audio/webm', 'admission')
    await vi.advanceTimersByTimeAsync(701)
    const result = await pending

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.error).toBeUndefined()
    expect(result.fields.admission_date?.value).toBe('2024-06-06')
    expect(result.fields.admission_standard?.value).toBe('1')
  })

  it('aborts a request that exceeds its timeout', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await extractVoiceFields(
      Buffer.from('audio'),
      'audio/webm',
      'identity',
      { timeoutMs: 5, attempts: 1 }
    )

    expect(result.error).toBe('Gemini audio request timed out after 5 ms')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed structured JSON', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{not-json' }] } }],
    }), { status: 200 })))

    const result = await extractVoiceFields(Buffer.from('audio'), 'audio/webm', 'identity')

    expect(result.error).toBe('Gemini audio response was not valid JSON')
    expect(result.fields).toEqual({})
  })

  it('rejects fields when the same response has no audit transcript', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWithModelJson({
      transcript: '   ',
      fields: { admission_date: '2024-06-06' },
    })))

    const result = await extractVoiceFields(Buffer.from('audio'), 'audio/webm', 'admission')

    expect(result.error).toBe('Gemini audio returned an empty transcript')
    expect(result.fields).toEqual({})
  })

  it('returns the actual multi-student array without padding to the expected count', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue(responseWithModelJson({
      transcript: 'Entry one GR 42 Jagdish Dixit. Entry two GR 43 Mira Patel. Entry three GR 44 Jay Thakor.',
      students: [
        {
          gr_number: 'forty two',
          student_name: 'Jagdish Dixit',
          fathers_name: '',
          mothers_name: '',
          surname: '',
          date_of_birth: 'sixth January two thousand sixteen',
          admission_date: 'tenth June two thousand twenty two',
          admission_standard: 'standard one',
        },
        { gr_number: '43', student_name: 'Mira', surname: 'Patel' },
        { gr_number: '44', student_name: 'Jay', surname: 'Thakor' },
      ],
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await extractVoice(Buffer.from('multi-audio'), 'audio/webm', {
      mode: 'multi',
      expectedCount: 4,
      model: 'gemini-test',
      attempts: 1,
    })

    expect(result.mode).toBe('multi')
    expect(result.students).toHaveLength(3)
    expect(result.students[0]).toMatchObject({
      gr_number: { value: '42', confidence: 'high' },
      student_name: { value: 'Jagdish', confidence: 'high' },
      surname: { value: 'Dixit', confidence: 'high' },
      date_of_birth: { value: '2016-01-06', confidence: 'high' },
      admission_date: { value: '2022-06-10', confidence: 'medium' },
      admission_standard: { value: '1', confidence: 'medium' },
    })

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    const studentSchema = request.generationConfig.responseSchema.properties.students.items
    expect(Object.keys(studentSchema.properties)).toHaveLength(19)
    expect(studentSchema.required).toHaveLength(19)
    expect(request.contents[0].parts[1].text).toContain('expects 4 entries')
    expect(request.contents[0].parts[1].text).toContain('Never pad')
    expect(request.contents[0].parts[0].inline_data.mime_type).toBe('audio/webm')
  })
})
