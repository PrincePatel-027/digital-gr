'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface ImageUploaderProps {
  onUpload: (path: string) => void
  onFileSelect?: (file: File) => void
  schoolId?: string
  className?: string
  disabled?: boolean
}

export default function ImageUploader({
  onUpload,
  onFileSelect,
  schoolId: schoolIdProp,
  className = '',
  disabled = false,
}: ImageUploaderProps) {
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const schoolId = schoolIdProp || profile?.school_id

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setError(null)
      setUploaded(false)
      setFileName(file.name)

      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target?.result as string)
      reader.readAsDataURL(file)

      onFileSelect?.(file)

      if (!schoolId) {
        setError('Unable to determine school. Please log in again.')
        return
      }

      setUploading(true)

      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const uuid = crypto.randomUUID()
        const storagePath = `${schoolId}/${uuid}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('gr-images')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) throw new Error(uploadError.message)

        setUploaded(true)
        onUpload(storagePath)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (err instanceof TypeError && (msg.includes('fetch') || msg.includes('network'))) {
          setError('Upload interrupted — check your internet connection.')
        } else if (msg.includes('permission') || msg.includes('policy') || msg.includes('403')) {
          setError('Permission denied. Contact your administrator.')
        } else {
          setError('Upload failed. Please try again.')
        }
      } finally {
        setUploading(false)
      }
    },
    [schoolId, onUpload, onFileSelect]
  )

  const handleReset = () => {
    setPreview(null)
    setUploaded(false)
    setError(null)
    setFileName(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {!preview ? (
        <label
          htmlFor="image-upload"
          className={`flex flex-col items-center justify-center rounded-2xl min-h-[160px]
            border border-dashed
            ${disabled
              ? 'border-line-strong bg-surface-2/50 cursor-not-allowed opacity-50'
              : 'border-line-strong bg-surface hover:border-accent hover:bg-accent/[0.04] cursor-pointer'
            }
            transition-colors p-8 text-center`}
        >
          <span className="w-12 h-12 rounded-2xl bg-surface-2 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-ink-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </span>
          <p className="text-sm text-ink-soft font-medium mb-1">
            <span className="text-accent font-semibold">Tap to upload</span> or take a photo
          </p>
          <p className="text-xs text-ink-faint">
            JPG, PNG, WebP, TIFF or PDF · up to 10 MB
          </p>
          <input
            ref={fileRef}
            id="image-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/tiff,application/pdf"
            capture="environment"
            onChange={handleFileChange}
            disabled={disabled || uploading}
            className="sr-only"
          />
        </label>
      ) : (
        <div className="neu-card overflow-hidden">
          {/* Image */}
          <div className="relative">
            <img
              src={preview}
              alt="Upload preview"
              className="w-full max-h-64 object-contain bg-surface-2"
            />

            {/* Uploading overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-paper/85 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 animate-spin text-ink" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm font-semibold">Uploading…</span>
                </div>
              </div>
            )}

            {/* Success badge */}
            {uploaded && (
              <div className="absolute top-3 right-3">
                <span className="neu-badge bg-success text-white">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Uploaded
                </span>
              </div>
            )}
          </div>

          {/* File info */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-line">
            <span className="text-xs text-ink-soft font-medium truncate max-w-[200px]">
              {fileName}
            </span>
            <button
              onClick={handleReset}
              disabled={uploading}
              className="text-xs font-semibold text-accent hover:underline disabled:opacity-30"
            >
              Replace
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="neu-card-flat p-4" style={{ borderColor: '#dc2626' }}>
          <p className="text-sm text-error font-semibold mb-2">{error}</p>
          <button onClick={handleReset} className="neu-btn neu-btn-ghost text-sm min-h-[36px] px-4">
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
