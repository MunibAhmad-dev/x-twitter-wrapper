import { useState, useEffect, useRef, useCallback } from 'react'
import { useUIStore } from '../store/uiStore'
import { safeCopy } from '../lib/clipboard'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextMessage {
  id: string; sender: 'me' | 'them'; type: 'text'; text: string; time: string
}
interface VoiceMessage {
  id: string; sender: 'me' | 'them'; type: 'voice'; dataUrl: string; duration: number; time: string
}
interface VideoMessage {
  id: string; sender: 'me' | 'them'; type: 'video'; dataUrl: string; time: string
}
type Message = TextMessage | VoiceMessage | VideoMessage

interface Conversation {
  id: string; name: string; initials: string; avatarColor: string
  lastMessage: string; lastTime: string; unread: number; messages: Message[]
}

type CallState =
  | 'idle'
  | 'audio-requesting' | 'audio-active' | 'audio-denied'
  | 'video-requesting' | 'video-active' | 'video-denied'

type RecMode = 'voice' | 'video' | null
type ContextMenuState = { x: number; y: number; text: string } | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nowTime = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const fmtSecs = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

function bestMime(kind: 'audio' | 'video'): string {
  if (kind === 'video') {
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus'
    if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm'
    return ''
  }
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  return ''
}

const MEDIA_KEY = 'demo_media'
const saveMedia = (id: string, url: string) => {
  try {
    const store = JSON.parse(localStorage.getItem(MEDIA_KEY) || '{}')
    store[id] = url
    localStorage.setItem(MEDIA_KEY, JSON.stringify(store))
  } catch {}
}
const deleteMedia = (id: string) => {
  try {
    const store = JSON.parse(localStorage.getItem(MEDIA_KEY) || '{}')
    delete store[id]
    localStorage.setItem(MEDIA_KEY, JSON.stringify(store))
  } catch {}
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const INITIAL_CONVOS: Conversation[] = [
  {
    id: '1', name: 'Sarah Chen', initials: 'SC', avatarColor: '#1D9BF0',
    lastMessage: 'That thread went absolutely viral 🔥', lastTime: '2m', unread: 2,
    messages: [
      { id: 'm1', sender: 'them', type: 'text', text: "Hey! Your thread on AI trends was so good 🙌", time: '10:14 AM' },
      { id: 'm2', sender: 'them', type: 'text', text: "It's already at 2k retweets — did you expect that?", time: '10:14 AM' },
      { id: 'm3', sender: 'me', type: 'text', text: "Honestly no! I just shared what I was thinking 😅", time: '10:15 AM' },
      { id: 'm4', sender: 'them', type: 'text', text: "That thread went absolutely viral 🔥", time: '10:16 AM' },
    ],
  },
  {
    id: '2', name: 'Marcus Williams', initials: 'MW', avatarColor: '#0a66c2',
    lastMessage: 'Want to co-author a piece on this?', lastTime: '15m', unread: 1,
    messages: [
      { id: 'm1', sender: 'them', type: 'text', text: "Your take on the market correction was spot on 📊", time: '10:02 AM' },
      { id: 'm2', sender: 'me', type: 'text', text: "Thanks Marcus! Been watching it for weeks", time: '10:04 AM' },
      { id: 'm3', sender: 'them', type: 'text', text: "Want to co-author a piece on this?", time: '10:06 AM' },
    ],
  },
  {
    id: '3', name: 'Luna Rodriguez', initials: 'LR', avatarColor: '#7C3AED',
    lastMessage: '¿Cuándo publicamos el hilo?', lastTime: '1h', unread: 3,
    messages: [
      { id: 'm1', sender: 'them', type: 'text', text: "¡Hola! Me encantó tu hilo sobre startups 🚀", time: '9:12 AM' },
      { id: 'm2', sender: 'them', type: 'text', text: "¿Podemos hacer uno juntos sobre LatAm tech?", time: '9:13 AM' },
      { id: 'm3', sender: 'me', type: 'text', text: "¡Claro! Me parece una gran idea 🙌", time: '9:14 AM' },
      { id: 'm4', sender: 'them', type: 'text', text: "¿Cuándo publicamos el hilo?", time: '9:22 AM' },
    ],
  },
  {
    id: '4', name: 'X Support', initials: 'XS', avatarColor: '#000000',
    lastMessage: 'Your account has been verified ✓', lastTime: '3h', unread: 0,
    messages: [
      { id: 'm1', sender: 'them', type: 'text', text: "🎉 Congratulations! Your account has been verified ✓", time: '7:30 AM' },
      { id: 'm2', sender: 'them', type: 'text', text: "You now have access to X Premium features, longer posts, and analytics.", time: '7:30 AM' },
    ],
  },
  {
    id: '5', name: 'Jake Thompson', initials: 'JT', avatarColor: '#F97316',
    lastMessage: 'Appreciate the repost, means a lot!', lastTime: 'Yesterday', unread: 0,
    messages: [
      { id: 'm1', sender: 'them', type: 'text', text: "Appreciate the repost, means a lot! 🙏", time: 'Yesterday' },
      { id: 'm2', sender: 'me', type: 'text', text: "Great content deserves reach. Keep it up! 💪", time: 'Yesterday' },
    ],
  },
  {
    id: '6', name: 'Aria Patel', initials: 'AP', avatarColor: '#536471',
    lastMessage: 'What scheduling tool do you use?', lastTime: '2d', unread: 0,
    messages: [
      { id: 'm1', sender: 'them', type: 'text', text: "Your posting consistency is impressive ✨", time: '2 days ago' },
      { id: 'm2', sender: 'them', type: 'text', text: "What scheduling tool do you use for X?", time: '2 days ago' },
      { id: 'm3', sender: 'me', type: 'text', text: "I use Apps for X & Twitter — it handles all my accounts in one place 🙌", time: '2 days ago' },
    ],
  },
]

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ initials, color, size }: { initials: string; color: string; size: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      color: 'white', flexShrink: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: Math.round(size * 0.31), fontWeight: 700,
    }}>
      {initials}
    </div>
  )
}

// ─── VoicePlayer (Web Audio API) ──────────────────────────────────────────────

function VoicePlayer({ dataUrl, isMine, onDelete }: { dataUrl: string; isMine: boolean; onDelete?: () => void }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentSec, setCurrentSec] = useState(0)
  const [decoded, setDecoded] = useState(false)
  const [duration, setDuration] = useState(0)
  const bufferRef = useRef<AudioBuffer | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const srcRef = useRef<AudioBufferSourceNode | null>(null)
  const startRef = useRef(0)
  const offsetRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const sep = dataUrl.indexOf(';base64,')
    const b64 = dataUrl.slice(sep + 8)
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    ctx.decodeAudioData(bytes.buffer).then(buf => {
      if (cancelled) return
      bufferRef.current = buf
      setDuration(buf.duration)
      setDecoded(true)
    }).catch(() => {})
    return () => {
      cancelled = true
      srcRef.current?.stop()
      cancelAnimationFrame(rafRef.current)
      ctx.close()
    }
  }, [dataUrl])

  const stopSrc = () => {
    srcRef.current?.stop()
    srcRef.current = null
    cancelAnimationFrame(rafRef.current)
  }

  const play = useCallback(async () => {
    const ctx = ctxRef.current
    const buf = bufferRef.current
    if (!ctx || !buf) return
    if (ctx.state === 'suspended') await ctx.resume()
    stopSrc()
    const node = ctx.createBufferSource()
    node.buffer = buf
    node.connect(ctx.destination)
    node.start(0, offsetRef.current)
    srcRef.current = node
    startRef.current = ctx.currentTime - offsetRef.current
    setPlaying(true)
    node.onended = () => {
      if (srcRef.current !== node) return
      srcRef.current = null
      offsetRef.current = 0
      setProgress(0); setCurrentSec(0); setPlaying(false)
      cancelAnimationFrame(rafRef.current)
    }
    const tick = () => {
      if (!ctxRef.current || !bufferRef.current) return
      const elapsed = ctxRef.current.currentTime - startRef.current
      const p = Math.min(elapsed / bufferRef.current.duration, 1)
      setProgress(p)
      setCurrentSec(elapsed)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const pause = useCallback(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    offsetRef.current = ctx.currentTime - startRef.current
    stopSrc()
    setPlaying(false)
  }, [])

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const buf = bufferRef.current
    if (!decoded || !buf) return
    const rect = e.currentTarget.getBoundingClientRect()
    offsetRef.current = ((e.clientX - rect.left) / rect.width) * buf.duration
    if (playing) play()
    else { setProgress(offsetRef.current / buf.duration); setCurrentSec(offsetRef.current) }
  }

  const fg = isMine ? 'white' : '#1D9BF0'
  const trackBg = isMine ? 'rgba(255,255,255,0.3)' : 'var(--border)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
      <button
        onClick={() => playing ? pause() : play()}
        disabled={!decoded}
        style={{
          width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0,
          background: isMine ? 'rgba(255,255,255,0.2)' : 'rgba(29,155,240,0.12)',
          color: fg, cursor: decoded ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        }}
      >
        {!decoded ? '…' : playing ? '⏸' : '▶'}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div onClick={seek} style={{
          height: 4, borderRadius: 2, background: trackBg,
          position: 'relative', cursor: decoded ? 'pointer' : 'default',
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2,
            width: `${progress * 100}%`, background: fg,
          }} />
        </div>
        <span style={{ fontSize: 10, opacity: 0.65 }}>
          {decoded ? `${fmtSecs(Math.floor(currentSec))} / ${fmtSecs(Math.ceil(duration))}` : 'Loading…'}
        </span>
      </div>
      {onDelete && (
        <button onClick={onDelete} title="Delete" style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--muted-foreground)',
          fontSize: 13, padding: 2, flexShrink: 0,
        }}>🗑</button>
      )}
    </div>
  )
}

// ─── Video blob store ─────────────────────────────────────────────────────────
// Keep raw Blobs in a module-level Map so VideoPlayer can create fresh blob URLs
// without any FileReader / base64 / atob conversion (all of which can be blocked
// or corrupted by Electron's CSP).
const videoBlobStore = new Map<string, Blob>()

// ─── VideoPlayer ──────────────────────────────────────────────────────────────

function VideoPlayer({ dataUrl, isMine, onDelete }: { dataUrl: string; isMine: boolean; onDelete?: () => void }) {
  const [blobUrl, setBlobUrl] = useState('')

  useEffect(() => {
    const id = dataUrl.startsWith('blobref:') ? dataUrl.slice(8) : null
    const blob = id ? videoBlobStore.get(id) : null
    console.log('[VideoPlayer] id=', id, 'blob=', blob ? `size:${blob.size} type:${blob.type}` : 'NOT FOUND')
    if (!blob) return
    const url = URL.createObjectURL(blob)
    console.log('[VideoPlayer] blobUrl=', url)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [dataUrl])

  return (
    <div style={{ position: 'relative', width: 220 }}>
      {!blobUrl
        ? <div style={{ width: '100%', height: 80, borderRadius: 12, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⏳</div>
        : <video key={blobUrl} src={blobUrl} controls playsInline preload="auto"
            style={{ width: '100%', borderRadius: 12, display: 'block', background: '#000' }} />
      }
      {onDelete && (
        <button onClick={onDelete} title="Delete" style={{
          position: 'absolute', top: 6, right: 6,
          background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%',
          width: 26, height: 26, cursor: 'pointer', color: 'white', fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
        }}>🗑</button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DemoMessagingView() {
  const { setIsDemoMode, setActiveView, setDemoToolbar, pendingDemoText, setPendingDemoText } = useUIStore()

  const [convos, setConvos] = useState<Conversation[]>(INITIAL_CONVOS)
  const [activeId, setActiveId] = useState('1')
  const [inputText, setInputText] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)

  // Call state
  const [callState, setCallState] = useState<CallState>('idle')
  const callStreamRef = useRef<MediaStream | null>(null)
  const videoCallRef = useRef<HTMLVideoElement>(null)
  const [callTimer, setCallTimer] = useState(0)
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Call recording
  const [callRecording, setCallRecording] = useState(false)
  const [callRecTimer, setCallRecTimer] = useState(0)
  const callRecChunksRef = useRef<Blob[]>([])
  const callRecorderRef = useRef<MediaRecorder | null>(null)
  const callRecIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Input bar recording
  const [recMode, setRecMode] = useState<RecMode>(null)
  const [recTimer, setRecTimer] = useState(0)
  const recStreamRef = useRef<MediaStream | null>(null)
  const recVideoRef = useRef<HTMLVideoElement>(null)
  const recChunksRef = useRef<Blob[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeConvo = convos.find(c => c.id === activeId)!

  // Attach stream to video element after state updates
  useEffect(() => {
    if (recMode === 'video' && recVideoRef.current && recStreamRef.current)
      recVideoRef.current.srcObject = recStreamRef.current
  }, [recMode])

  useEffect(() => {
    if (callState === 'video-active' && videoCallRef.current && callStreamRef.current)
      videoCallRef.current.srcObject = callStreamRef.current
  }, [callState])

  useEffect(() => {
    if (!pendingDemoText) return
    setInputText(pendingDemoText)
    setPendingDemoText('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [pendingDemoText, setPendingDemoText])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [activeId, convos])

  useEffect(() => {
    if (!contextMenu) return
    const hide = () => setContextMenu(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null) }
    document.addEventListener('mousedown', hide)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', hide); document.removeEventListener('keydown', onKey) }
  }, [contextMenu])

  useEffect(() => {
    return () => {
      recStreamRef.current?.getTracks().forEach(t => t.stop())
      callStreamRef.current?.getTracks().forEach(t => t.stop())
      if (recIntervalRef.current) clearInterval(recIntervalRef.current)
      if (callTimerRef.current) clearInterval(callTimerRef.current)
      if (callRecIntervalRef.current) clearInterval(callRecIntervalRef.current)
    }
  }, [])

  const addMessage = useCallback((msg: Message) => {
    const preview = msg.type === 'text' ? msg.text : msg.type === 'voice' ? '🎤 Voice message' : '🎥 Video message'
    setConvos(prev => prev.map(c =>
      c.id === activeId
        ? { ...c, messages: [...c.messages, msg], lastMessage: preview, lastTime: 'now', unread: 0 }
        : c
    ))
  }, [activeId])

  const deleteMessage = (msgId: string, type: 'voice' | 'video') => {
    if (type === 'voice') deleteMedia(msgId)
    if (type === 'video') videoBlobStore.delete(msgId)
    setConvos(prev => prev.map(c =>
      c.id === activeId ? { ...c, messages: c.messages.filter(m => m.id !== msgId) } : c
    ))
  }

  const selectConvo = (id: string) => {
    setActiveId(id)
    setConvos(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c))
  }

  const sendMessage = () => {
    const text = inputText.trim()
    if (!text) return
    addMessage({ id: Date.now().toString(), sender: 'me', type: 'text', text, time: nowTime() })
    setInputText('')
  }

  const exitDemo = () => { setIsDemoMode(false); setActiveView('messaging') }

  // ── VOICE CALL ───────────────────────────────────────────────────────────────
  const startVoiceCall = async () => {
    setCallState('audio-requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      callStreamRef.current = stream
      setCallState('audio-active')
      setCallTimer(0)
      callTimerRef.current = setInterval(() => setCallTimer(t => t + 1), 1000)
    } catch {
      setCallState('audio-denied')
    }
  }

  // ── VIDEO CALL ───────────────────────────────────────────────────────────────
  const startVideoCall = async () => {
    setCallState('video-requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      callStreamRef.current = stream
      setCallState('video-active')
      setCallTimer(0)
      callTimerRef.current = setInterval(() => setCallTimer(t => t + 1), 1000)
    } catch {
      setCallState('video-denied')
    }
  }

  const endCall = () => {
    if (callRecording && callRecorderRef.current) {
      callRecorderRef.current.onstop = null
      callRecorderRef.current.stop()
      if (callRecIntervalRef.current) clearInterval(callRecIntervalRef.current)
      setCallRecording(false); setCallRecTimer(0)
    }
    callStreamRef.current?.getTracks().forEach(t => t.stop())
    callStreamRef.current = null
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    setCallTimer(0); setCallState('idle')
  }

  const startCallRecording = () => {
    const stream = callStreamRef.current
    if (!stream || callRecording) return
    callRecChunksRef.current = []
    const recorder = new MediaRecorder(stream)
    recorder.ondataavailable = e => { if (e.data.size > 0) callRecChunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(callRecChunksRef.current, { type: recorder.mimeType })
      const id = Date.now().toString()
      videoBlobStore.set(id, blob)
      addMessage({ id, sender: 'me', type: 'video', dataUrl: `blobref:${id}`, time: nowTime() })
    }
    recorder.start(100)
    callRecorderRef.current = recorder
    setCallRecording(true)
    setCallRecTimer(0)
    callRecIntervalRef.current = setInterval(() => setCallRecTimer(t => t + 1), 1000)
  }

  const stopCallRecording = () => {
    if (callRecIntervalRef.current) clearInterval(callRecIntervalRef.current)
    setCallRecording(false)
    setCallRecTimer(0)
    callRecorderRef.current?.stop()
    callRecorderRef.current = null
  }

  // ── VOICE MESSAGE ────────────────────────────────────────────────────────────
  const startVoiceRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recStreamRef.current = stream
      const mime = bestMime('audio')
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data) }
      recorder.start()
      recorderRef.current = recorder
      setRecMode('voice'); setRecTimer(0)
      recIntervalRef.current = setInterval(() => setRecTimer(t => t + 1), 1000)
    } catch {}
  }

  const stopVoiceRec = () => {
    const recorder = recorderRef.current
    const stream = recStreamRef.current
    if (!recorder || !stream) return
    const captured = stream
    recorder.onstop = () => {
      if (recStreamRef.current === captured) recStreamRef.current = null
      captured.getTracks().forEach(t => t.stop())
      const dur = recTimer
      const blob = new Blob(recChunksRef.current, { type: recorder.mimeType })
      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        const id = Date.now().toString()
        saveMedia(id, dataUrl)
        addMessage({ id, sender: 'me', type: 'voice', dataUrl, duration: dur, time: nowTime() })
      }
      reader.readAsDataURL(blob)
      recChunksRef.current = []
    }
    recorder.stop()
    if (recIntervalRef.current) clearInterval(recIntervalRef.current)
    setRecMode(null); setRecTimer(0); recorderRef.current = null
  }

  // ── VIDEO MESSAGE ────────────────────────────────────────────────────────────
  const startVideoRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      console.log('[VideoRec] got stream, tracks:', stream.getTracks().map(t => `${t.kind}:${t.label}`))
      recStreamRef.current = stream
      recChunksRef.current = []
      const mime = bestMime('video')
      console.log('[VideoRec] mimeType to use:', mime || '(browser default)')
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorder.ondataavailable = e => {
        console.log('[VideoRec] chunk size:', e.data.size)
        if (e.data.size > 0) recChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const s = recStreamRef.current
        s?.getTracks().forEach(t => t.stop())
        if (recStreamRef.current === stream) recStreamRef.current = null
        console.log('[VideoRec] onstop — chunks:', recChunksRef.current.length, 'mimeType:', recorder.mimeType)
        const blob = new Blob(recChunksRef.current, { type: recorder.mimeType })
        console.log('[VideoRec] blob size:', blob.size, 'type:', blob.type)
        if (blob.size === 0) { console.warn('[VideoRec] blob is empty — dropping'); return }
        const id = Date.now().toString()
        videoBlobStore.set(id, blob)
        addMessage({ id, sender: 'me', type: 'video', dataUrl: `blobref:${id}`, time: nowTime() })
      }
      recorder.start(100)
      console.log('[VideoRec] recording started')
      recorderRef.current = recorder
      setRecMode('video')
      setRecTimer(0)
      recIntervalRef.current = setInterval(() => setRecTimer(t => t + 1), 1000)
    } catch (err) {
      console.error('[VideoRec] failed to start:', err)
    }
  }

  const stopVideoRec = () => {
    clearInterval(recIntervalRef.current!)
    setRecMode(null)
    setRecTimer(0)
    recorderRef.current?.stop()
    recorderRef.current = null
  }

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const text = window.getSelection()?.toString().trim()
    if (!text) return
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, text })
  }, [])

  const contextMenuItems = [
    { icon: '📋', label: 'Copy', action: () => { safeCopy(contextMenu!.text); setContextMenu(null) } },
    { icon: '🤖', label: 'AI Reply', action: () => { setDemoToolbar('ai', contextMenu!.text); setContextMenu(null) } },
    { icon: '🌐', label: 'Translate', action: () => { setDemoToolbar('translate', contextMenu!.text); setContextMenu(null) } },
    { icon: '✍️', label: 'Quick Reply', action: () => { setDemoToolbar('quick-reply', contextMenu!.text); setContextMenu(null) } },
  ]

  const inCall = callState !== 'idle'
  const isVideoCall = callState.startsWith('video')

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--background)', position: 'relative' }}>

      <style>{`
        @keyframes dmoPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.25);opacity:0.6} }
        @keyframes dmoSpin  { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── CALL OVERLAY ──────────────────────────────────────────────────────── */}
      {inCall && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.88)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          {(callState === 'audio-requesting' || callState === 'video-requesting') && (
            <>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                animation: 'dmoSpin 0.8s linear infinite',
              }} />
              <p style={{ color: 'white', fontSize: 15, fontWeight: 500 }}>
                Requesting {isVideoCall ? 'camera & microphone' : 'microphone'} access…
              </p>
              <button onClick={endCall} style={btnStyle('#555')}>Cancel</button>
            </>
          )}

          {(callState === 'audio-denied' || callState === 'video-denied') && (
            <>
              <span style={{ fontSize: 48 }}>🚫</span>
              <p style={{ color: 'white', fontSize: 15, fontWeight: 600 }}>
                {isVideoCall ? 'Camera & microphone' : 'Microphone'} access denied
              </p>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, textAlign: 'center', maxWidth: 280 }}>
                Allow access in System Settings → Privacy & Security →{' '}
                {isVideoCall ? 'Camera / Microphone' : 'Microphone'}
              </p>
              <button onClick={endCall} style={btnStyle('#555')}>Dismiss</button>
            </>
          )}

          {callState === 'audio-active' && (
            <>
              <Avatar initials={activeConvo.initials} color={activeConvo.avatarColor} size={72} />
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: 'rgba(34,197,94,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'dmoPulse 1.4s ease-in-out infinite',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%', background: '#22C55E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                }}>📞</div>
              </div>
              <p style={{ color: 'white', fontSize: 16, fontWeight: 600 }}>{activeConvo.name}</p>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>Voice call active · {fmtSecs(callTimer)}</p>
              <button onClick={endCall} style={btnStyle('#EF4444')}>✕ End Call</button>
            </>
          )}

          {callState === 'video-active' && (
            <>
              <video ref={videoCallRef} autoPlay muted playsInline
                style={{ width: 320, height: 240, borderRadius: 16, background: '#111', objectFit: 'cover' }} />
              <p style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>
                {activeConvo.name} · {fmtSecs(callTimer)}
              </p>
              {callRecording ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: '#EF4444', fontSize: 12, fontWeight: 700 }}>🔴 {fmtSecs(callRecTimer)}</span>
                  <button onClick={stopCallRecording} style={btnStyle('#22C55E')}>⏹ Stop & Save</button>
                </div>
              ) : (
                <button onClick={startCallRecording} style={btnStyle('#333')}>🔴 Record</button>
              )}
              <button onClick={endCall} style={btnStyle('#EF4444')}>✕ End Call</button>
            </>
          )}
        </div>
      )}

      {/* ── VIDEO REC OVERLAY ─────────────────────────────────────────────────── */}
      {recMode === 'video' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
        }}>
          <video ref={recVideoRef} autoPlay muted playsInline
            style={{ width: 320, height: 240, borderRadius: 16, background: '#111', objectFit: 'cover' }} />
          <p style={{ color: '#EF4444', fontSize: 14, fontWeight: 700 }}>🔴 {fmtSecs(recTimer)}</p>
          <button onClick={stopVideoRec} style={btnStyle('#22C55E')}>⏹ Stop & Send</button>
          <button onClick={() => {
            recorderRef.current?.stop()
            recStreamRef.current?.getTracks().forEach(t => t.stop())
            recStreamRef.current = null; recorderRef.current = null
            if (recIntervalRef.current) clearInterval(recIntervalRef.current)
            setRecMode(null); setRecTimer(0); recChunksRef.current = []
          }} style={{ ...btnStyle('#555'), marginTop: -4 }}>Cancel</button>
        </div>
      )}

      {/* ── SIDEBAR ───────────────────────────────────────────────────────────── */}
      <div style={{
        width: 300, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', background: 'var(--background)',
      }}>
        <div style={{
          padding: '11px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', flex: 1 }}>
            Direct Messages
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: 'linear-gradient(135deg, #1D9BF0, #60CDFF)',
            color: 'white', borderRadius: 99, padding: '2px 7px',
          }}>DEMO</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {convos.map(convo => (
            <button key={convo.id} onClick={() => selectConvo(convo.id)} style={{
              width: '100%', padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              background: convo.id === activeId ? 'var(--accent)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
            }}>
              <Avatar initials={convo.initials} color={convo.avatarColor} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                  <span style={{
                    fontSize: 13, fontWeight: convo.unread > 0 ? 700 : 500,
                    color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{convo.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>{convo.lastTime}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, gap: 4 }}>
                  <span style={{
                    fontSize: 11, color: 'var(--muted-foreground)', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    fontWeight: convo.unread > 0 ? 600 : 400,
                  }}>{convo.lastMessage}</span>
                  {convo.unread > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, background: '#1D9BF0', color: 'white',
                      borderRadius: 99, padding: '2px 5px', flexShrink: 0,
                    }}>{convo.unread}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button onClick={exitDemo} style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--muted-foreground)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#1D9BF0'; (e.currentTarget as HTMLElement).style.borderColor = '#1D9BF0' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
          >✕ Exit Demo Mode</button>
        </div>
      </div>

      {/* ── THREAD VIEW ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Avatar initials={activeConvo.initials} color={activeConvo.avatarColor} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{activeConvo.name}</div>
            <div style={{ fontSize: 10, color: '#22C55E', fontWeight: 500 }}>● Active now</div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
            background: 'linear-gradient(135deg, #1D9BF0, #60CDFF)',
            color: 'white', borderRadius: 99, padding: '2px 7px', flexShrink: 0,
          }}>DEMO MODE</span>
          {/* Voice call */}
          <button onClick={startVoiceCall} disabled={inCall} title="Voice Call" style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: inCall ? 'var(--muted)' : 'rgba(34,197,94,0.12)',
            color: inCall ? 'var(--muted-foreground)' : '#22C55E',
            cursor: inCall ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
          }}>📞</button>
          {/* Video call */}
          <button onClick={startVideoCall} disabled={inCall} title="Video Call" style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: inCall ? 'var(--muted)' : 'rgba(29,155,240,0.12)',
            color: inCall ? 'var(--muted-foreground)' : '#1D9BF0',
            cursor: inCall ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
          }}>📹</button>
        </div>

        {/* Messages */}
        <div ref={threadRef} onContextMenu={handleContextMenu} style={{
          flex: 1, overflowY: 'auto', padding: '16px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {activeConvo.messages.map(msg => {
            const isMine = msg.sender === 'me'
            return (
              <div key={msg.id} style={{
                display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end', gap: 7,
              }}>
                {!isMine && <Avatar initials={activeConvo.initials[0]} color={activeConvo.avatarColor} size={24} />}
                <div style={{
                  maxWidth: msg.type === 'video' ? 236 : '65%',
                  padding: msg.type === 'video' ? 0 : '9px 13px',
                  wordBreak: 'break-word',
                  borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.type === 'video'
                    ? 'transparent'
                    : isMine ? 'linear-gradient(135deg, #1D9BF0 0%, #60CDFF 100%)' : 'var(--muted)',
                  color: isMine ? 'white' : 'var(--foreground)',
                  fontSize: 13, lineHeight: 1.5, userSelect: 'text',
                }}>
                  {msg.type === 'text' && msg.text}
                  {msg.type === 'voice' && (
                    <VoicePlayer dataUrl={msg.dataUrl} isMine={isMine}
                      onDelete={isMine ? () => deleteMessage(msg.id, 'voice') : undefined} />
                  )}
                  {msg.type === 'video' && (
                    <VideoPlayer dataUrl={msg.dataUrl} isMine={isMine}
                      onDelete={isMine ? () => deleteMessage(msg.id, 'video') : undefined} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '3px 16px', textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
            💡 Select any message text and right-click to use AI Reply, Translate, or Quick Reply
          </span>
        </div>

        {/* Input bar */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
          {recMode === 'voice' ? (
            <>
              <span style={{ color: '#EF4444', fontSize: 12, fontWeight: 700 }}>🔴 Recording {fmtSecs(recTimer)}</span>
              <div style={{ flex: 1 }} />
              <button onClick={stopVoiceRec} style={btnStyle('#22C55E', { padding: '6px 16px', fontSize: 12 })}>⏹ Stop</button>
            </>
          ) : (
            <>
              <button onClick={startVoiceRec} disabled={!!recMode || inCall} title="Send voice message" style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: 'var(--muted)', color: 'var(--muted-foreground)',
                cursor: recMode || inCall ? 'default' : 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>🎤</button>
              <button onClick={startVideoRec} disabled={!!recMode || inCall} title="Send video message" style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: 'var(--muted)', color: 'var(--muted-foreground)',
                cursor: recMode || inCall ? 'default' : 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>🎥</button>
              <input ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Type a message…"
                style={{
                  flex: 1, padding: '9px 14px', borderRadius: 22,
                  border: '1px solid var(--border)', background: 'var(--muted)',
                  color: 'var(--foreground)', fontSize: 13, outline: 'none',
                }} />
              <button onClick={sendMessage} disabled={!inputText.trim()} style={{
                padding: '9px 18px', borderRadius: 22, border: 'none', flexShrink: 0,
                background: inputText.trim() ? 'linear-gradient(135deg, #1D9BF0, #60CDFF)' : 'var(--muted)',
                color: inputText.trim() ? 'white' : 'var(--muted-foreground)',
                fontSize: 13, fontWeight: 600, cursor: inputText.trim() ? 'pointer' : 'default', transition: 'all 0.15s',
              }}>Send</button>
            </>
          )}
        </div>
      </div>

      {/* ── CONTEXT MENU ──────────────────────────────────────────────────────── */}
      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 9999,
          background: 'var(--background)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          overflow: 'hidden', minWidth: 170,
        }} onMouseDown={e => e.stopPropagation()}>
          {contextMenuItems.map(item => (
            <button key={item.label} onClick={item.action} style={{
              width: '100%', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 9,
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              fontSize: 13, color: 'var(--foreground)',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span style={{ fontWeight: 500 }}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function btnStyle(bg: string, extra?: React.CSSProperties): React.CSSProperties {
  return { padding: '9px 22px', borderRadius: 22, border: 'none', background: bg, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s', ...extra }
}
