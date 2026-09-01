'use client'

import { useCallback, useState } from 'react'
import GroupedVoiceEntryRecorder from '@/components/GroupedVoiceEntryRecorder'
import MultiVoiceEntryRecorder from '@/components/MultiVoiceEntryRecorder'
import type {
  VoiceEntryMode,
  VoiceEntryResponse,
  VoiceGroupId,
  VoiceLanguage,
  VoiceMultiEntryResponse,
} from '@/lib/voice-types'

interface VoiceEntryRecorderProps {
  disabled?: boolean
  language?: VoiceLanguage
  onGroupComplete: (result: VoiceEntryResponse) => void
  onGroupClear?: (group: VoiceGroupId) => void
  onMultiComplete?: (result: VoiceMultiEntryResponse) => void
  onMultiClear?: () => void
  onEntryModeChange?: (mode: VoiceEntryMode) => void
  onProcessingChange?: (busy: boolean) => void
  onSessionStart?: () => void
  onReset?: () => void
}

export default function VoiceEntryRecorder({
  disabled = false,
  language = 'en-IN',
  onGroupComplete,
  onGroupClear,
  onMultiComplete,
  onMultiClear,
  onEntryModeChange,
  onProcessingChange,
  onSessionStart,
  onReset,
}: VoiceEntryRecorderProps) {
  const [entryMode, setEntryMode] = useState<VoiceEntryMode>('single')
  const [childBusy, setChildBusy] = useState(false)

  const handleProcessingChange = useCallback((busy: boolean) => {
    setChildBusy(busy)
    onProcessingChange?.(busy)
  }, [onProcessingChange])

  function selectEntryMode(nextMode: VoiceEntryMode) {
    if (nextMode === entryMode || childBusy || disabled) return
    setChildBusy(false)
    onProcessingChange?.(false)
    onReset?.()
    setEntryMode(nextMode)
    onEntryModeChange?.(nextMode)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Voice entry</p>
          <p className="text-xs text-ink-soft mt-1">
            Choose one student with four guided groups, or several students in one continuous recording.
          </p>
        </div>
        <span className="neu-badge bg-accent/10 text-accent shrink-0">{language}</span>
      </div>

      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Voice entry type">
        <button
          type="button"
          onClick={() => selectEntryMode('single')}
          disabled={disabled || childBusy}
          aria-pressed={entryMode === 'single'}
          className={`neu-btn text-xs ${entryMode === 'single' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
        >
          Single entry
        </button>
        <button
          type="button"
          onClick={() => selectEntryMode('multi')}
          disabled={disabled || childBusy}
          aria-pressed={entryMode === 'multi'}
          className={`neu-btn text-xs ${entryMode === 'multi' ? 'neu-btn-primary' : 'neu-btn-ghost'}`}
        >
          Multiple entries
        </button>
      </div>

      {entryMode === 'single' ? (
        <GroupedVoiceEntryRecorder
          key="single"
          disabled={disabled}
          language={language}
          onGroupComplete={onGroupComplete}
          onGroupClear={onGroupClear}
          onProcessingChange={handleProcessingChange}
          onSessionStart={onSessionStart}
          onReset={onReset}
        />
      ) : (
        <MultiVoiceEntryRecorder
          key="multi"
          disabled={disabled}
          language={language}
          onComplete={onMultiComplete}
          onClear={onMultiClear}
          onProcessingChange={handleProcessingChange}
          onSessionStart={onSessionStart}
          onReset={onReset}
        />
      )}
    </div>
  )
}
