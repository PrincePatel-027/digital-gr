import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  authorizeRequest: vi.fn(),
  runVoicePipeline: vi.fn(),
  runVoiceComparison: vi.fn(),
  isVoiceCompareEnabled: vi.fn(() => false),
  getVoiceHealth: vi.fn(() => ({ status: 'ok' })),
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
    runVoiceComparison: mocks.runVoiceComparison,
    isVoiceCompareEnabled: mocks.isVoiceCompareEnabled,
    getVoiceHealth: mocks.getVoiceHealth,
  }
})

import { POST } from './route'

const SUCCESS = {
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
  mocks.runVoicePipeline.mockReset()
  mocks.runVoiceComparison.mockReset()
  mocks.isVoiceCompareEnabled.mockReset().mockReturnValue(false)
  mocks.runVoicePipeline.mockResolvedValue(SUCCESS)

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

  it('returns the expected no-store response for a valid request', async () => {
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
  })

  it('runs every configured model without first-wins in authenticated compare mode', async () => {
    const comparison = {
      mode: 'compare',
      group: 'identity',
      language: 'en-IN',
      results: [
        {
          source: 'gemini-audio',
          model: 'gemini-a',
          transcript: 'Student Jagdish Dixit.',
          fields: SUCCESS.fields,
          ms: 120,
          error: null,
        },
        {
          source: 'gemini-audio',
          model: 'gemini-b',
          transcript: 'Student Jagdish Dixit.',
          fields: SUCCESS.fields,
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
    expect(mocks.runVoiceComparison).toHaveBeenCalledOnce()
    expect(mocks.runVoicePipeline).not.toHaveBeenCalled()
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
