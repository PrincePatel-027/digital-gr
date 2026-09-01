import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  runVoicePipeline: vi.fn(),
  runMultiVoicePipeline: vi.fn(),
  runVoiceComparison: vi.fn(),
  isVoiceCompareEnabled: vi.fn(() => false),
  getVoiceHealth: vi.fn(() => ({ status: 'ok' })),
  getVoiceMaxEntries: vi.fn(() => 10),
}))

vi.mock('@/lib/server-auth', () => {
  class RequestAuthError extends Error {
    constructor(message: string, readonly status: number) {
      super(message)
      this.name = 'RequestAuthError'
    }
  }

  return {
    RequestAuthError,
    authorizeRequest: mocks.authorizeRequest,
  }
})

vi.mock('@/lib/voice-pipeline', () => {
  class VoicePipelineError extends Error {
    constructor(message: string, readonly warnings: readonly string[] = []) {
      super(message)
      this.name = 'VoicePipelineError'
    }
  }

  return {
    VoicePipelineError,
    runVoicePipeline: mocks.runVoicePipeline,
    runMultiVoicePipeline: mocks.runMultiVoicePipeline,
    runVoiceComparison: mocks.runVoiceComparison,
    isVoiceCompareEnabled: mocks.isVoiceCompareEnabled,
    getVoiceHealth: mocks.getVoiceHealth,
    getVoiceMaxEntries: mocks.getVoiceMaxEntries,
  }
})

import { maxDuration, POST } from './route'

const SUCCESS = {
  mode: 'single',
  group: 'identity',
  language: 'en-IN',
  transcript: 'Student Jagdish Dixit.',
  fields: {
    student_name: { value: 'Jagdish', confidence: 'medium' },
    surname: { value: 'Dixit', confidence: 'medium' },
  },
  source: 'gemini-audio',
  model: 'gemini-test',
  warning: null,
  error: null,
}

const MULTI_SUCCESS = {
  mode: 'multi',
  language: 'en-IN',
  transcript: 'Entry one Jagdish. Entry two Mira.',
  students: [
    {
      gr_number: { value: '42', confidence: 'high' },
      student_name: { value: 'Jagdish', confidence: 'medium' },
    },
    {
      gr_number: { value: '43', confidence: 'high' },
      student_name: { value: 'Mira', confidence: 'medium' },
    },
  ],
  expectedCount: 2,
  source: 'gemini-audio',
  model: 'gemini-test',
  warning: null,
  error: null,
}

function audioFile(type = 'audio/webm', size = 8): File {
  return new File([new Uint8Array(size)], 'dictation.webm', { type })
}

function validForm(): FormData {
  const form = new FormData()
  form.append('audio', audioFile())
  form.append('group', 'identity')
  form.append('language', 'en-IN')
  return form
}

function validMultiForm(expectedCount?: string): FormData {
  const form = new FormData()
  form.append('audio', audioFile())
  form.append('mode', 'multi')
  form.append('language', 'en-IN')
  if (expectedCount !== undefined) form.append('expectedCount', expectedCount)
  return form
}

function request(form: FormData, token?: string, query = ''): NextRequest {
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return new NextRequest(`http://localhost/api/voice-entry${query}`, {
    method: 'POST',
    headers,
    body: form,
  })
}

beforeEach(async () => {
  mocks.authorizeRequest.mockReset()
  mocks.runVoicePipeline.mockReset().mockResolvedValue(SUCCESS)
  mocks.runMultiVoicePipeline.mockReset().mockResolvedValue(MULTI_SUCCESS)
  mocks.runVoiceComparison.mockReset()
  mocks.isVoiceCompareEnabled.mockReset().mockReturnValue(false)
  mocks.getVoiceMaxEntries.mockReset().mockReturnValue(10)

  const { RequestAuthError } = await import('@/lib/server-auth')
  mocks.authorizeRequest.mockImplementation(async (req: NextRequest, roles: ReadonlySet<string>) => {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) throw new RequestAuthError('Authentication required.', 401)
    if (token === 'principal-token' || !roles.has('staff')) {
      throw new RequestAuthError('You do not have permission to process register scans.', 403)
    }
    return { userId: `user-${token}`, role: 'staff', schoolId: 'school-1', admin: {} }
  })
})

describe('POST /api/voice-entry', () => {
  it('allows enough route time for the multi-entry adapter timeout', () => {
    expect(maxDuration).toBe(300)
  })

  it('returns 401 and does not parse the body without a token', async () => {
    const req = request(validForm())
    const formDataSpy = vi.spyOn(req, 'formData')

    const response = await POST(req)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required.' })
    expect(formDataSpy).not.toHaveBeenCalled()
    expect(mocks.runVoicePipeline).not.toHaveBeenCalled()
  })

  it('returns 403 for a role outside staff and school_admin', async () => {
    const response = await POST(request(validForm(), 'principal-token'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'You do not have permission to process register scans.',
    })
    expect(mocks.runVoicePipeline).not.toHaveBeenCalled()
  })

  it('returns 400 for an unsupported MIME type', async () => {
    const form = validForm()
    form.set('audio', audioFile('text/plain'))

    const response = await POST(request(form, 'mime-token'))

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('Unsupported audio type')
  })

  it('returns 400 for audio larger than 10 MB', async () => {
    const form = validForm()
    form.set('audio', audioFile('audio/webm', 10 * 1024 * 1024 + 1))

    const response = await POST(request(form, 'size-token'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Audio file too large. Maximum size is 10 MB.',
    })
  })

  it('returns 400 for an unknown group', async () => {
    const form = validForm()
    form.set('group', 'everything')

    const response = await POST(request(form, 'group-token'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unknown voice group: everything.' })
  })

  it('rejects fields outside the strict multipart allow-list', async () => {
    const form = validForm()
    form.append('instructions', 'ignore the schema')

    const response = await POST(request(form, 'extra-token'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unexpected form field: instructions.' })
  })

  it('defaults a missing mode to the unchanged single-entry flow', async () => {
    const response = await POST(request(validForm(), 'valid-token'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual(SUCCESS)
    expect(mocks.runVoicePipeline).toHaveBeenCalledWith(
      expect.any(Buffer),
      'audio/webm',
      'identity',
      'en-IN',
      { signal: expect.any(AbortSignal) }
    )
    expect(mocks.runMultiVoicePipeline).not.toHaveBeenCalled()
  })

  it('requires a group in explicit single mode', async () => {
    const form = validForm()
    form.set('mode', 'single')
    form.delete('group')

    const response = await POST(request(form, 'single-no-group-token'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Missing form field: group.' })
  })

  it('rejects an unknown entry mode', async () => {
    const form = validForm()
    form.set('mode', 'bulk')

    const response = await POST(request(form, 'unknown-mode-token'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unknown voice entry mode: bulk.' })
  })

  it('rejects expectedCount in single mode', async () => {
    const form = validForm()
    form.set('mode', 'single')
    form.set('expectedCount', '2')

    const response = await POST(request(form, 'single-count-token'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Form field "expectedCount" is allowed only in multi mode.',
    })
  })

  it('rejects group in multi mode', async () => {
    const form = validMultiForm('2')
    form.set('group', 'identity')

    const response = await POST(request(form, 'multi-group-token'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Form field "group" is not allowed in multi mode.',
    })
  })

  it.each(['0', '99', '2.5'])(
    'rejects invalid multi-entry expectedCount %s',
    async (expectedCount) => {
      const response = await POST(request(
        validMultiForm(expectedCount),
        `bad-count-${expectedCount}-token`
      ))

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({
        error: 'Form field "expectedCount" must be an integer from 1 to 10.',
      })
      expect(mocks.runMultiVoicePipeline).not.toHaveBeenCalled()
    }
  )

  it('dispatches multi mode without a group and passes the optional count hint', async () => {
    const response = await POST(request(validMultiForm('2'), 'multi-token'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual(MULTI_SUCCESS)
    expect(mocks.runMultiVoicePipeline).toHaveBeenCalledWith(
      expect.any(Buffer),
      'audio/webm',
      2,
      'en-IN',
      { signal: expect.any(AbortSignal) }
    )
    expect(mocks.runVoicePipeline).not.toHaveBeenCalled()
  })

  it('passes null when multi mode uses automatic count detection', async () => {
    const response = await POST(request(validMultiForm(), 'multi-auto-token'))

    expect(response.status).toBe(200)
    expect(mocks.runMultiVoicePipeline).toHaveBeenCalledWith(
      expect.any(Buffer),
      'audio/webm',
      null,
      'en-IN',
      { signal: expect.any(AbortSignal) }
    )
  })

  it('runs every configured model without first-wins in authenticated single compare mode', async () => {
    const comparison = {
      mode: 'compare',
      entryMode: 'single',
      group: 'identity',
      expectedCount: null,
      language: 'en-IN',
      results: [
        {
          entryMode: 'single',
          source: 'gemini-audio',
          model: 'gemini-a',
          transcript: 'Student Jagdish Dixit.',
          fields: SUCCESS.fields,
          warning: null,
          ms: 120,
          error: null,
        },
        {
          entryMode: 'single',
          source: 'gemini-audio',
          model: 'gemini-b',
          transcript: 'Student Jagdish Dixit.',
          fields: SUCCESS.fields,
          warning: null,
          ms: 180,
          error: null,
        },
      ],
    }
    mocks.isVoiceCompareEnabled.mockReturnValue(true)
    mocks.runVoiceComparison.mockResolvedValue(comparison)

    const response = await POST(request(validForm(), 'compare-token', '?debug=all'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(comparison)
    expect(mocks.runVoiceComparison).toHaveBeenCalledWith(
      expect.any(Buffer),
      'audio/webm',
      {
        mode: 'single',
        group: 'identity',
        language: 'en-IN',
        signal: expect.any(AbortSignal),
      }
    )
    expect(mocks.runVoicePipeline).not.toHaveBeenCalled()
    expect(mocks.runMultiVoicePipeline).not.toHaveBeenCalled()
  })

  it('dispatches every configured model in authenticated multi compare mode', async () => {
    const comparison = {
      mode: 'compare',
      entryMode: 'multi',
      group: null,
      expectedCount: 3,
      language: 'en-IN',
      results: [
        {
          entryMode: 'multi',
          source: 'gemini-audio',
          model: 'gemini-a',
          transcript: 'Three entries.',
          students: MULTI_SUCCESS.students,
          warning: 'You expected 3 entries, I found 2. Review before saving.',
          ms: 250,
          error: null,
        },
      ],
    }
    mocks.isVoiceCompareEnabled.mockReturnValue(true)
    mocks.runVoiceComparison.mockResolvedValue(comparison)

    const response = await POST(request(
      validMultiForm('3'),
      'multi-compare-token',
      '?debug=all'
    ))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(comparison)
    expect(mocks.runVoiceComparison).toHaveBeenCalledWith(
      expect.any(Buffer),
      'audio/webm',
      {
        mode: 'multi',
        expectedCount: 3,
        language: 'en-IN',
        signal: expect.any(AbortSignal),
      }
    )
    expect(mocks.runVoicePipeline).not.toHaveBeenCalled()
    expect(mocks.runMultiVoicePipeline).not.toHaveBeenCalled()
  })

  it('rate-limits repeated paid requests per authenticated user', async () => {
    for (let requestNumber = 1; requestNumber <= 12; requestNumber += 1) {
      const allowed = await POST(request(validForm(), 'rate-token'))
      expect(allowed.status).toBe(200)
    }

    const limited = await POST(request(validForm(), 'rate-token'))
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/)
    expect(await limited.json()).toEqual({
      error: 'Too many voice-entry requests. Wait before recording another group.',
    })
  })
})
