'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

// ── Types ─────────────────────────────────────────────────────
interface ImageUploaderProps {
  /** Called with the storage path after successful upload */
  onUpload: (path: string) => void
  /** Optional: called with the File object when selected (before upload) */
  onFileSelect?: (file: File) => void
  /** Optional: override the school_id folder (defaults to auth context) */
  schoolId?: string
  /** Optional: additional CSS classes for the container */
  className?: string
  /** Optional: disable the component */
  disabled?: boolean
}

// ── Component ─────────────────────────────────────────────────
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

      // Preview
      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target?.result as string)
      reader.readAsDataURL(file)

      onFileSelect?.(file)

      // Upload
      if (!schoolId) {
        setError('Unable to determine school. Please log in again.')
        return
      }

      setUploading(true)

      try {
        // Generate unique filename: school_id/uuid.ext
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const uuid = crypto.randomUUID()
        const storagePath = `${schoolId}/${uuid}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('gr-images')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw new Error(uploadError.message)
        }

        setUploaded(true)
        onUpload(storagePath)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // Categorize errors for friendly messages
        if (err instanceof TypeError && (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch'))) {
          setError('Upload interrupted \u2014 it looks like your internet connection was lost. Please check your connection and try again.')
        } else if (msg.includes('permission') || msg.includes('policy') || msg.includes('Unauthorized') || msg.includes('403')) {
          setError('We couldn\'t save your image to our servers. This might be a permissions issue \u2014 please contact your administrator.')
        } else if (msg.includes('quota') || msg.includes('storage') || msg.includes('413')) {
          setError('The storage is currently full. Please contact your administrator to resolve this issue.')
        } else {
          setError('Something went wrong while uploading your file. Please try again, or use a different image.')
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
      {/* File input area */}
      {!preview ? (
        <label
          htmlFor="image-upload"
          className={`flex flex-col items-center justify-center rounded-[24px] border-2 border-dashed min-h-[140px]
            ${disabled ? 'border-[#0f2846]/20 bg-white/20 cursor-not-allowed' : 'border-[#0f2846]/20 bg-white/40 hover:border-[#3a86c6]/50 hover:bg-white/60 cursor-pointer shadow-sm'}
            transition p-8 text-center`}
        >
          <svg
            className="w-10 h-10 text-[#0f2846]/40 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm text-[#0f2846]/60 font-medium mb-1">
            <span className="text-[#3a86c6] font-bold">Click to upload</span>{' '}
            or drag and drop
          </p>
          <p className="text-xs text-[#0f2846]/40 font-medium">
            JPG, PNG, WebP, TIFF, or PDF — max 10 MB
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
        /* Preview + status */
        <div className="rounded-[24px] glass-panel overflow-hidden shadow-sm">
          {/* Image */}
          <div className="relative">
            <img
              src={preview}
              alt="Upload preview"
              className="w-full max-h-64 object-contain bg-white/40"
            />

            {/* Uploading overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                <div className="flex items-center gap-3 text-[#0f2846]">
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span className="text-sm font-medium">Uploading…</span>
                </div>
              </div>
            )}

            {/* Success overlay */}
            {uploaded && (
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6b9e78]/10 border border-[#6b9e78]/30 px-3 py-1.5 text-xs font-bold text-[#6b9e78] shadow-sm">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Uploaded
                </span>
              </div>
            )}
          </div>

          {/* File info bar */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-[#0f2846]/10 bg-white/30">
            <span className="text-xs text-[#0f2846]/60 font-medium truncate max-w-[200px]">
              {fileName}
            </span>
            <button
              onClick={handleReset}
              disabled={uploading}
              className="text-xs text-[#0f2846]/50 hover:text-[#0f2846] transition disabled:opacity-30 font-bold"
            >
              Replace
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl bg-red-50/80 border border-red-200 px-4 py-4 space-y-3 shadow-sm"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
          <button
            onClick={handleReset}
            className="rounded-xl border border-red-200 bg-red-100/50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-200/50 transition min-h-[40px] shadow-sm"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
