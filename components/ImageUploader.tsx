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
          className={`flex flex-col items-center justify-center rounded-lg min-h-[140px]
            border-2 border-dashed
            ${disabled
              ? 'border-[#d4d0c8] bg-[#f0ede8] cursor-not-allowed opacity-50'
              : 'border-[#1a1a1a]/30 bg-[#f0ede8] hover:border-[#4338ca] cursor-pointer'
            }
            transition p-8 text-center`}
        >
          <svg className="w-8 h-8 text-[#9a9590] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-[#6b6b6b] font-semibold mb-1">
            <span className="text-[#4338ca] font-bold">Tap to upload</span> or take a photo
          </p>
          <p className="text-xs text-[#9a9590] font-medium">
            JPG, PNG, WebP, TIFF, PDF — max 10 MB
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
              className="w-full max-h-64 object-contain bg-[#e8e4de]"
            />

            {/* Uploading overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-[#f0ede8]/80 flex items-center justify-center">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 animate-spin text-[#1a1a1a]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm font-bold">Uploading…</span>
                </div>
              </div>
            )}

            {/* Success badge */}
            {uploaded && (
              <div className="absolute top-3 right-3">
                <span className="neu-badge bg-[#16a34a] text-white">
                  ✓ Uploaded
                </span>
              </div>
            )}
          </div>

          {/* File info */}
          <div className="flex items-center justify-between px-4 py-3 border-t-2 border-[#1a1a1a]">
            <span className="text-xs text-[#6b6b6b] font-medium truncate max-w-[200px]">
              {fileName}
            </span>
            <button
              onClick={handleReset}
              disabled={uploading}
              className="text-xs font-bold text-[#4338ca] hover:underline disabled:opacity-30"
            >
              Replace
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="neu-card-flat p-4" style={{ borderColor: '#dc2626' }}>
          <p className="text-sm text-red-700 font-bold mb-2">{error}</p>
          <button onClick={handleReset} className="neu-btn neu-btn-ghost text-xs min-h-[36px] px-4">
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
