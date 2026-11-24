import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Volume2,
  X,
} from 'lucide-react';
import { Deal, WorkspaceSettings } from '../types/crm';
import { formatCurrency } from '../utils/formatters';

interface VoiceAdvisorPanelProps {
  open: boolean;
  onClose: () => void;
  deals: Deal[];
  settings: WorkspaceSettings;
  authToken: string;
  onUnauthorized: () => void;
}

type VoiceName = 'Zephyr' | 'Kore' | 'Fenrir' | 'Puck' | 'Charon';

interface TranscriptEntry {
  id: string;
  speaker: 'You' | 'Emergent Advisor';
  text: string;
}

const VOICE_OPTIONS: VoiceName[] = ['Zephyr', 'Kore', 'Fenrir', 'Puck', 'Charon'];

function floatTo16BitPcmBase64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm24kToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(new ArrayBuffer(sampleCount * 4));
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export const VoiceAdvisorPanel: React.FC<VoiceAdvisorPanelProps> = ({
  open,
  onClose,
  deals,
  settings,
  authToken,
  onUnauthorized,
}) => {
  const [status, setStatus] = useState<
    'idle' | 'connecting' | 'live' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState<VoiceName>('Zephyr');
  const [muted, setMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [textInput, setTextInput] = useState('');

  // Mutable refs for audio pipeline and callbacks (no stale closures!)
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mutedRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Build concise live pipeline summary for systemInstruction
  const crmSummary = useMemo(() => {
    const closedWon = deals
      .filter((d) => d.stage === 'Closed Won')
      .reduce((s, d) => s + d.value, 0);
    const openDeals = deals.filter((d) => d.stage !== 'Closed Won');
    const weighted =
      closedWon +
      openDeals.reduce((s, d) => s + Math.round((d.value * d.probability) / 100), 0);
    const atRisk = openDeals.filter((d) => d.health === 'At Risk');

    const topLines = deals
      .slice(0, 12)
      .map(
        (d) =>
          `- ${d.account} (${d.name}): ${formatCurrency(d.value)} | Stage: ${d.stage} (${d.probability}%) | Health: ${d.health} | Close: ${d.closeDate} | Next: ${d.nextStep}`
      )
      .join('\n');

    return [
      `Fiscal Period: ${settings.fiscalQuarter}`,
      `Quarterly Quota: ${formatCurrency(settings.quarterlyQuota)}`,
      `Closed Won ARR: ${formatCurrency(closedWon)}`,
      `Total Weighted Forecast: ${formatCurrency(weighted)}`,
      `At-Risk Deals Count: ${atRisk.length} (${atRisk.map((d) => d.account).join(', ') || 'None'})`,
      'Active Opportunities:',
      topLines,
    ].join('\n');
  }, [deals, settings]);

  const stopPlaybackQueue = () => {
    activeSourcesRef.current.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch {
        // ignore already stopped
      }
    });
    activeSourcesRef.current = [];
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  };

  const schedulePcm24kPlayback = (base64Audio: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const samples = base64Pcm24kToFloat32(base64Audio);
    if (samples.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.copyToChannel(samples, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  };

  const appendTranscript = (speaker: 'You' | 'Emergent Advisor', chunk: string) => {
    const clean = chunk.trim();
    if (!clean) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text} ${clean}`.replace(/\s+/g, ' ') },
        ];
      }
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text: clean,
        },
      ];
    });
  };

  const disconnectSession = () => {
    stopPlaybackQueue();

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setMicLevel(0);
    setStatus('idle');
  };

  const startSession = async () => {
    disconnectSession();
    setErrorMsg(null);
    setStatus('connecting');
    setTranscripts([]);

    try {
      // Request microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Dedicated 16kHz input and 24kHz output AudioContexts per Live API spec
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live-voice`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'init',
            token: authToken,
            voiceName,
            crmSummary,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type?: string;
            audio?: string;
            text?: string;
            error?: string;
          };

          if (msg.type === 'ready') {
            setStatus('live');
            // Wire mic capture once Live session is ready
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            sourceNodeRef.current = source;
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (mutedRef.current || ws.readyState !== WebSocket.OPEN) {
                setMicLevel(0);
                return;
              }
              const channelData = e.inputBuffer.getChannelData(0);
              let sumSq = 0;
              for (let i = 0; i < channelData.length; i++) {
                sumSq += channelData[i] * channelData[i];
              }
              const rms = Math.sqrt(sumSq / channelData.length);
              setMicLevel(Math.min(1, rms * 6.5));

              const base64Pcm = floatTo16BitPcmBase64(channelData);
              ws.send(JSON.stringify({ type: 'audio', audio: base64Pcm }));
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          } else if (msg.type === 'audio' && msg.audio) {
            schedulePcm24kPlayback(msg.audio);
          } else if (msg.type === 'interrupted') {
            stopPlaybackQueue();
          } else if (msg.type === 'inputTranscript' && msg.text) {
            appendTranscript('You', msg.text);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            appendTranscript('Emergent Advisor', msg.text);
          } else if (msg.type === 'error') {
            setErrorMsg(msg.error || 'Live voice session error.');
            setStatus('error');
          } else if (msg.type === 'closed') {
            setStatus('idle');
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        setErrorMsg('WebSocket connection to Live Voice server failed.');
        setStatus('error');
      };

      ws.onclose = (event) => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          if (event.code === 4401) {
            onUnauthorized();
            return;
          }
          setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
        }
      };
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Microphone access or audio initialization failed.';
      setErrorMsg(msg);
      setStatus('error');
      disconnectSession();
      setStatus('error');
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = textInput.trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    appendTranscript('You', clean);
    wsRef.current.send(JSON.stringify({ type: 'text', text: clean }));
    setTextInput('');
  };

  // Cleanup when drawer closes or component unmounts
  useEffect(() => {
    if (!open && wsRef.current) {
      disconnectSession();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#060e20]/75 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Live Executive Voice Advisor"
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-[#464554]/50 bg-[#131b2e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#464554]/35 bg-[#171f33] px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#c0c1ff]">
              <Volume2 className="h-3.5 w-3.5 text-[#4edea3]" />
              <span>Real-Time Voice · gemini-3.8-live</span>
            </div>
            <h2 className="mt-1 text-[17px] font-semibold text-[#dae2fd]">
              Executive Revenue Advisor
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice advisor"
            className="rounded p-1.5 text-[#908fa0] hover:bg-[#222a3d] hover:text-[#dae2fd] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Voice Controls & Live Input Meter */}
        <div className="border-b border-[#464554]/30 px-5 py-4 space-y-4 bg-[#0b1326]/60">
          <div className="flex items-center justify-between gap-3">
            <label className="text-[12px] font-medium text-[#c7c4d7]">
              Voice Persona
            </label>
            <select
              value={voiceName}
              disabled={status === 'live' || status === 'connecting'}
              onChange={(e) => setVoiceName(e.target.value as VoiceName)}
              className="h-8 rounded border border-[#464554]/55 bg-[#171f33] px-2.5 text-[12px] text-[#dae2fd] disabled:opacity-50 focus:border-[#6366F1] focus:outline-none"
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Call / Disconnect Action */}
          <div className="flex items-center gap-2.5">
            {status !== 'live' && status !== 'connecting' ? (
              <button
                type="button"
                onClick={startSession}
                className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded bg-[#6366F1] px-4 text-[13px] font-medium text-white hover:bg-[#5558e6] transition-colors"
              >
                <Mic className="h-4 w-4" />
                Start Voice Session
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  className={`flex-1 inline-flex h-10 items-center justify-center gap-2 rounded border px-3 text-[13px] font-medium transition-colors ${
                    muted
                      ? 'border-[#ef4444]/45 bg-[#93000a]/25 text-[#ffb4ab]'
                      : 'border-[#464554]/55 bg-[#171f33] text-[#dae2fd] hover:bg-[#222a3d]'
                  }`}
                >
                  {muted ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Muted
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 text-[#4edea3]" />
                      Listening
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={disconnectSession}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded border border-[#ef4444]/45 bg-[#171f33] px-3.5 text-[13px] font-medium text-[#ffb4ab] hover:bg-[#93000a]/35 transition-colors"
                >
                  <PhoneOff className="h-4 w-4" />
                  End
                </button>
              </>
            )}
          </div>

          {/* Real RMS Microphone Level Meter */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-[#908fa0]">
              <span>
                {status === 'live'
                  ? 'Connected · Speak naturally or type below'
                  : status === 'connecting'
                  ? 'Connecting to Gemini Live...'
                  : 'Session inactive · Grounded on live CRM deals'}
              </span>
              <span className="font-mono tabular-nums">
                {status === 'live' ? '16kHz / 24kHz' : 'Standby'}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#171f33] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#10B981] transition-all duration-75"
                style={{ width: `${Math.round(micLevel * 100)}%` }}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="rounded border border-[#ef4444]/40 bg-[#93000a]/25 px-3 py-2 text-[12px] text-[#ffb4ab]">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Live Transcript Stream */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {transcripts.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-[13px] text-[#c7c4d7]">
                Ask live spoken questions about your {settings.fiscalQuarter} revenue pipeline:
              </p>
              <div className="space-y-2 text-left text-[12px] text-[#908fa0]">
                <div className="rounded border border-[#464554]/30 bg-[#171f33] px-3 py-2">
                  "Which accounts are currently at risk and what should we do before December?"
                </div>
                <div className="rounded border border-[#464554]/30 bg-[#171f33] px-3 py-2">
                  "How far are we from our {formatCurrency(settings.quarterlyQuota, true)} quarterly quota?"
                </div>
                <div className="rounded border border-[#464554]/30 bg-[#171f33] px-3 py-2">
                  "Summarize our Commit deals in Negotiation stage."
                </div>
              </div>
            </div>
          ) : (
            transcripts.map((entry) => (
              <div
                key={entry.id}
                className={`rounded-lg border px-3.5 py-2.5 text-[13px] ${
                  entry.speaker === 'You'
                    ? 'ml-6 border-[#6366F1]/40 bg-[#6366F1]/14 text-[#e1e0ff]'
                    : 'mr-6 border-[#464554]/35 bg-[#171f33] text-[#dae2fd]'
                }`}
              >
                <div className="text-[11px] font-semibold text-[#908fa0] mb-1">
                  {entry.speaker}
                </div>
                <p className="leading-relaxed">{entry.text}</p>
              </div>
            ))
          )}
          <div ref={transcriptsEndRef} />
        </div>

        {/* Optional Typed Follow-Up During Live Session */}
        <form
          onSubmit={handleSendText}
          className="flex items-center gap-2 border-t border-[#464554]/35 bg-[#171f33] px-4 py-3"
        >
          <input
            type="text"
            value={textInput}
            disabled={status !== 'live'}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={
              status === 'live'
                ? 'Or type a prompt into the live session...'
                : 'Start voice session to converse...'
            }
            className="h-9 flex-1 rounded border border-[#464554]/50 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0] disabled:opacity-50 focus:border-[#6366F1] focus:outline-none"
          />
          <button
            type="submit"
            disabled={status !== 'live' || !textInput.trim()}
            aria-label="Send prompt"
            className="flex h-9 w-9 items-center justify-center rounded bg-[#6366F1] text-white hover:bg-[#5558e6] disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
