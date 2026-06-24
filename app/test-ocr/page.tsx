'use client'

import { useState, useRef } from 'react'

interface OcrResponse {
  text: string
  mode: 'real' | 'mock'
  mock: boolean
  error: string | null
  fileName: string
  fileSize: number
  fileType: string
}

export default function TestOcrPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<OcrResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('Please select an image file first.')
      return
    }

    setError(null)
    setResult(null)
    setLoading(true)

    // Preview
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    // Upload
    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/ocr-test', {
        method: 'POST',
        body: formData,
      })

      const data: OcrResponse = await res.json()

      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        setLoading(false)
        return
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">OCR Test Page</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Upload a scanned GR page image to test text extraction.
          </p>
        </div>

        {/* Upload Card */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 space-y-5">
          {/* File Input */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1 w-full">
              <label
                htmlFor="ocr-file"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                Select image
              </label>
              <input
                ref={fileRef}
                id="ocr-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/tiff,application/pdf"
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer file:transition"
              />
            </div>
            <button
              id="ocr-submit"
              onClick={handleUpload}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing…
                </span>
              ) : (
                'Extract Text'
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              id="ocr-error"
              className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3 text-sm text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Image Preview */}
            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Uploaded Image
              </h2>
              {preview && (
                <img
                  src={preview}
                  alt="Uploaded scan"
                  className="w-full rounded-lg border border-gray-700"
                />
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                <span>{result.fileName}</span>
                <span>{(result.fileSize / 1024).toFixed(1)} KB</span>
                <span>{result.fileType}</span>
              </div>
            </div>

            {/* Right: Extracted Text */}
            <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Extracted Text
                </h2>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    result.mock
                      ? 'bg-amber-900/50 border border-amber-700/50 text-amber-300'
                      : 'bg-emerald-900/50 border border-emerald-700/50 text-emerald-300'
                  }`}
                >
                  {result.mock ? '🧪 Mock' : '✅ Real OCR'}
                </span>
              </div>

              {result.error && (
                <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-3 py-2 text-sm text-red-300 mb-3">
                  {result.error}
                </div>
              )}

              <pre
                id="ocr-output"
                className="whitespace-pre-wrap text-sm text-gray-200 bg-gray-800/50 rounded-lg border border-gray-700/50 p-4 max-h-[500px] overflow-y-auto font-mono leading-relaxed"
              >
                {result.text || '(No text extracted)'}
              </pre>

              {result.mock && (
                <p className="mt-3 text-xs text-amber-400/70">
                  ⚠ Mock mode — set <code className="text-amber-300">GOOGLE_CLOUD_CREDENTIALS_BASE64</code>{' '}
                  in .env.local to use real OCR.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
