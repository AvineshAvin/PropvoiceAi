import React from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Trash2,
  AudioWaveform,
  AlertCircle,
} from 'lucide-react';

export default function VoiceAssistantPanel({
  voice,
  onClear,
  aiMode,
}) {
  const {
    sttSupported,
    ttsSupported,
    isListening,
    isSpeaking,
    isMuted,
    continuousMode,
    setContinuousMode,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    speechRate,
    setSpeechRate,
    voiceError,
    lastSpokenText,
    startListening,
    stopListening,
    replayLast,
    toggleMute,
  } = voice;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-[#111111] p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`relative flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#111111] shadow-sm ${
              isListening || isSpeaking ? 'ring-4 ring-white/30' : ''
            }`}
          >
            <AudioWaveform className={`h-6 w-6 ${isListening || isSpeaking ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold">PropVoice AI Agent</h2>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-brand-100">
                {aiMode === 'gemini' ? 'Gemini Live' : 'Smart Assistant'}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              {isListening
                ? 'Listening to your voice...'
                : isSpeaking
                ? 'Speaking response...'
                : 'Click the microphone or type below to start'}
            </p>
          </div>
        </div>

        {/* Playback & Conversation Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={!sttSupported}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow transition ${
              isListening
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-white text-[#111111] hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50'
            }`}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            <span>{isListening ? 'Stop Listening' : 'Start Voice'}</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
            className="rounded-xl border border-white/15 bg-white/10 p-2.5 text-slate-200 transition hover:bg-white/20"
          >
            {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={replayLast}
            disabled={!lastSpokenText || !ttsSupported}
            title="Replay last AI response"
            className="rounded-xl border border-white/15 bg-white/10 p-2.5 text-slate-200 transition hover:bg-white/20 disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onClear}
            title="Clear conversation"
            className="rounded-xl border border-white/15 bg-white/10 p-2.5 text-slate-200 transition hover:bg-rose-500/20 hover:text-rose-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Voice Settings Row */}
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/10 pt-3 text-xs text-slate-300">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={continuousMode}
            onChange={(e) => setContinuousMode(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-brand-500"
          />
          <span>Auto-listen after AI speaks</span>
        </label>

        {ttsSupported && voices.length > 0 && (
          <div className="flex items-center gap-2">
            <span>Voice:</span>
            <select
              value={selectedVoiceURI}
              onChange={(e) => setSelectedVoiceURI(e.target.value)}
              className="max-w-[180px] rounded-lg border border-white/15 bg-navy-800 px-2 py-1 text-xs text-white focus:outline-none"
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        )}

        {ttsSupported && (
          <div className="flex items-center gap-2">
            <span>Speed: {speechRate.toFixed(1)}x</span>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="w-20 accent-brand-500"
            />
          </div>
        )}
      </div>

      {(!sttSupported || voiceError) && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>
            {voiceError ||
              'Web Speech API is not supported in this browser. You can still chat using the text input below.'}
          </span>
        </div>
      )}
    </div>
  );
}
