import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AudioLines, Search, Plus, Play, Pause, SkipBack, SkipForward, Shuffle,
  Repeat2, Volume2, VolumeX, Download, Heart, Music2, Headphones, Sparkles,
  ListMusic, Disc3, Radio, ExternalLink, Upload, X, Check, Waves, Pencil, Trash2, HardDrive, ShieldCheck
} from 'lucide-react'
import { demoTracks, freeMusicLinks } from './data/tracks'

const DB_NAME = 'sonora-library'
const DB_VERSION = 1
const STORE_NAME = 'audio-tracks'

function openLibraryDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB is unavailable'))
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not open local music library'))
  })
}

async function saveTrackToLibrary(track) {
  const db = await openLibraryDb()
  return new Promise((resolve, reject) => {
    const { url, ...record } = track
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { const error = tx.error; db.close(); reject(error || new Error('Could not save audio')) }
    tx.onabort = () => { const error = tx.error; db.close(); reject(error || new Error('Audio save was cancelled')) }
  })
}

async function deleteTrackFromLibrary(id) {
  const db = await openLibraryDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { const error = tx.error; db.close(); reject(error || new Error('Could not delete audio')) }
    tx.onabort = () => { const error = tx.error; db.close(); reject(error || new Error('Audio deletion was cancelled')) }
  })
}

async function readLibraryTracks() {
  const db = await openLibraryDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      const records = request.result || []
      db.close()
      resolve(records.map((track) => ({ ...track, url: URL.createObjectURL(track.blob) })))
    }
    request.onerror = () => { const error = request.error; db.close(); reject(error || new Error('Could not read saved audio')) }
  })
}

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / (1024 ** index)).toFixed(index >= 2 ? 1 : 0)} ${units[index]}`
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
  reader.onerror = () => reject(reader.error || new Error('Could not read audio for backup'))
  reader.readAsDataURL(blob)
})

const base64ToBlob = (value, type = 'audio/mpeg') => {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

function Cover({ track, size = 'normal' }) {
  return (
    <div className={`cover ${size}`} style={{ background: track.cover || 'linear-gradient(135deg,#25253b,#5c4dff)' }}>
      {track.artwork ? <img src={track.artwork} alt="" /> : <AudioLines size={size === 'large' ? 38 : 23} strokeWidth={1.5} />}
    </div>
  )
}

export default function App() {
  const [uploads, setUploads] = useState([])
  const objectUrlsRef = useRef(new Set())
  const [libraryReady, setLibraryReady] = useState(false)
  const [youtubeItems, setYoutubeItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sonora-youtube-links') || '[]') } catch { return [] }
  })
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [activeId, setActiveId] = useState(demoTracks[0].id)
  const [playing, setPlaying] = useState(false)
  const [query, setQuery] = useState('')
  const [section, setSection] = useState('Discover')
  const [liked, setLiked] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sonora-liked-tracks') || '[]') } catch { return [] }
  })
  const [volume, setVolume] = useState(0.78)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [enhancer, setEnhancer] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [notice, setNotice] = useState('')
  const [storageInfo, setStorageInfo] = useState({ usage: 0, quota: 0, persistent: false })
  const backupInputRef = useRef(null)
  const audioRef = useRef(null)
  const fileInputRef = useRef(null)
  const audioContextRef = useRef(null)
  const sourceRef = useRef(null)
  const bassRef = useRef(null)
  const trebleRef = useRef(null)
  const compressorRef = useRef(null)
  const navigationTimerRef = useRef(null)
  const [isNavigating, setIsNavigating] = useState(false)

  const navigateToSection = (nextSection) => {
    if (nextSection === section) {
      document.querySelector('.tracks-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    setIsNavigating(true)
    setSection(nextSection)

    // Wait for React to render the selected collection before scrolling to it.
    window.requestAnimationFrame(() => {
      document.querySelector('.tracks-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.clearTimeout(navigationTimerRef.current)
      navigationTimerRef.current = window.setTimeout(() => setIsNavigating(false), 360)
    })
  }

  const allTracks = useMemo(() => [...uploads, ...demoTracks], [uploads])
  useEffect(() => {
    try { localStorage.setItem('sonora-youtube-links', JSON.stringify(youtubeItems)) } catch { /* storage may be disabled */ }
  }, [youtubeItems])

  useEffect(() => {
    let cancelled = false
    readLibraryTracks().then((savedTracks) => {
      if (cancelled) {
        savedTracks.forEach((track) => URL.revokeObjectURL(track.url))
        return
      }
      savedTracks.forEach((track) => objectUrlsRef.current.add(track.url))
      setUploads(savedTracks)
      setLibraryReady(true)
    }).catch(() => {
      if (!cancelled) {
        setLibraryReady(true)
        setNotice('Could not load saved music. Check browser storage permissions.')
      }
    })
    return () => { cancelled = true }
  }, [])

  const refreshStorageInfo = async () => {
    try {
      if (navigator.storage?.persist) {
        const persistent = await navigator.storage.persist()
        const estimate = await navigator.storage.estimate()
        setStorageInfo({ usage: estimate.usage || 0, quota: estimate.quota || 0, persistent })
      } else if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate()
        setStorageInfo({ usage: estimate.usage || 0, quota: estimate.quota || 0, persistent: false })
      }
    } catch { /* Storage estimates are optional and browser-dependent. */ }
  }

  useEffect(() => { void refreshStorageInfo() }, [uploads.length])

  const exportLibraryBackup = async () => {
    try {
      const db = await openLibraryDb()
      const records = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const request = tx.objectStore(STORE_NAME).getAll()
        request.onsuccess = () => resolve(request.result || [])
        request.onerror = () => reject(request.error)
      })
      db.close()
      const tracks = await Promise.all(records.map(async (track) => ({
        ...track, blob: undefined, audioBase64: track.blob ? await blobToBase64(track.blob) : '', audioType: track.blob?.type || 'audio/mpeg'
      })))
      const backup = { format: 'sonora-backup-v1', createdAt: new Date().toISOString(), tracks, liked, youtubeItems }
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sonora-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setNotice('Backup exported. Keep the file somewhere safe; it may be large if you have many songs.')
    } catch { setNotice('Backup could not be created. Check available device storage and try again.') }
  }

  const importLibraryBackup = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const backup = JSON.parse(await file.text())
      if (backup.format !== 'sonora-backup-v1' || !Array.isArray(backup.tracks)) throw new Error('Invalid backup')
      const restored = []
      for (const item of backup.tracks) {
        if (!item.id || !item.audioBase64) continue
        const { audioBase64, audioType, ...metadata } = item
        const blob = base64ToBlob(audioBase64, audioType)
        const track = { ...metadata, blob, source: 'upload', url: URL.createObjectURL(blob) }
        await saveTrackToLibrary(track)
        restored.push(track)
      }
      restored.forEach((track) => objectUrlsRef.current.add(track.url))
      setUploads((current) => {
        const byId = new Map(current.map((track) => [track.id, track]))
        restored.forEach((track) => byId.set(track.id, track))
        return [...byId.values()]
      })
      if (Array.isArray(backup.liked)) setLiked(backup.liked)
      if (Array.isArray(backup.youtubeItems)) setYoutubeItems(backup.youtubeItems)
      setSection('Your uploads')
      setNotice(`Restored ${restored.length} audio track${restored.length === 1 ? '' : 's'} from backup.`)
      await refreshStorageInfo()
    } catch { setNotice('This backup could not be restored. Choose a valid Sonora backup JSON file.') }
    event.target.value = ''
  }

  useEffect(() => {
    try { localStorage.setItem('sonora-liked-tracks', JSON.stringify(liked)) } catch { /* storage may be disabled */ }
  }, [liked])

  const addYoutubeLink = (event) => {
    event?.preventDefault()
    const originalUrl = youtubeUrl.trim()
    let videoId = ''
    let modifiedUrl = ''
    try {
      const parsed = new URL(originalUrl)
      const hostname = parsed.hostname.toLowerCase()
      if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
        videoId = parsed.pathname.split('/').filter(Boolean)[0] || ''
      } else if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
        videoId = parsed.searchParams.get('v') || parsed.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] || ''
      }
      // Change only the youtube.com hostname text; preserve the rest of the URL.
      modifiedUrl = originalUrl.replace(/youtube(?=\.com)/i, 'yout-ube')
    } catch { /* invalid URL */ }
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      setNotice('Paste a valid YouTube video URL, such as youtube.com/watch?v=…')
      return
    }
    if (youtubeItems.some((item) => item.videoId === videoId)) {
      setNotice('That YouTube link is already in your collection.')
      return
    }
    setYoutubeItems((items) => [{ id: `yt-${videoId}`, videoId, url: modifiedUrl, title: `YouTube video · ${videoId}`, addedAt: Date.now() }, ...items])
    setYoutubeUrl('')
    setSection('YouTube links')
    setNotice('Link added. Select “Watch Ad-Free Video” to open it.')
  }
  const activeTrack = allTracks.find((track) => track.id === activeId) || allTracks[0]
  const visibleTracks = useMemo(() => {
    let tracks = allTracks
    if (section === 'Liked') tracks = tracks.filter((track) => liked.includes(track.id))
    if (section === 'Your uploads') tracks = tracks.filter((track) => track.source === 'upload')
    if (section === 'YouTube links') tracks = []
    if (query.trim()) {
      const q = query.toLowerCase()
      tracks = tracks.filter((track) => `${track.title} ${track.artist} ${track.genre || ''}`.toLowerCase().includes(q))
    }
    return tracks
  }, [allTracks, section, liked, query])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !activeTrack) return
    audio.src = activeTrack.url
    audio.load()
    setCurrentTime(0)
    setDuration(0)
    if (playing) audio.play().catch(() => setPlaying(false))
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.play().catch(() => {
      setPlaying(false)
      setNotice('This track could not be played. Check your connection or choose another track.')
    })
    else audio.pause()
  }, [playing, activeId])


  useEffect(() => {
    if (!enhancer) return
    const audio = audioRef.current
    if (!audio) return
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) throw new Error('Web Audio unavailable')
      if (!audioContextRef.current) {
        const ctx = new AudioContextClass()
        const source = ctx.createMediaElementSource(audio)
        const bass = ctx.createBiquadFilter()
        bass.type = 'lowshelf'
        bass.frequency.value = 180
        bass.gain.value = 3
        const treble = ctx.createBiquadFilter()
        treble.type = 'highshelf'
        treble.frequency.value = 4200
        treble.gain.value = 2
        const compressor = ctx.createDynamicsCompressor()
        compressor.threshold.value = -20
        compressor.knee.value = 16
        compressor.ratio.value = 2.5
        compressor.attack.value = 0.004
        compressor.release.value = 0.18
        source.connect(bass).connect(treble).connect(compressor).connect(ctx.destination)
        audioContextRef.current = ctx
        sourceRef.current = source
        bassRef.current = bass
        trebleRef.current = treble
        compressorRef.current = compressor
      }
      audioContextRef.current.resume()
      bassRef.current.gain.value = 3
      trebleRef.current.gain.value = 2
      compressorRef.current.threshold.value = -20
    } catch {
      setNotice('Sound enhancement is not available in this browser.')
      setEnhancer(false)
    }
  }, [enhancer])

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current.clear()
    window.clearTimeout(navigationTimerRef.current)
    if (audioContextRef.current) audioContextRef.current.close()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const chooseTrack = (track) => {
    setActiveId(track.id)
    setPlaying(true)
  }

  const playNext = () => {
    const list = visibleTracks.length ? visibleTracks : allTracks
    const index = list.findIndex((track) => track.id === activeId)
    const nextIndex = shuffle ? Math.floor(Math.random() * list.length) : (index + 1) % list.length
    if (list[nextIndex]) chooseTrack(list[nextIndex])
  }

  const playPrevious = () => {
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0
      return
    }
    const list = visibleTracks.length ? visibleTracks : allTracks
    const index = list.findIndex((track) => track.id === activeId)
    chooseTrack(list[(index - 1 + list.length) % list.length] || allTracks[0])
  }

  // Register Sonora as the active media session so Android can keep audio
  // associated with a media app and expose lock-screen / notification controls.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const session = navigator.mediaSession
    const audio = audioRef.current

    try {
      if (activeTrack && 'MediaMetadata' in window) {
        session.metadata = new window.MediaMetadata({
          title: activeTrack.title || 'Sonora',
          artist: activeTrack.artist || 'Your library',
          album: activeTrack.album || 'Sonora',
        })
      }
      session.playbackState = playing ? 'playing' : 'paused'
    } catch { /* Media Session support varies by browser. */ }

    const run = (action, handler) => {
      try { session.setActionHandler(action, handler) } catch { /* Unsupported action. */ }
    }
    run('play', () => setPlaying(true))
    run('pause', () => setPlaying(false))
    run('previoustrack', playPrevious)
    run('nexttrack', playNext)
    run('seekbackward', (details) => {
      if (audio) audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10))
    })
    run('seekforward', (details) => {
      if (audio) audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (details.seekOffset || 10))
    })
    run('seekto', (details) => {
      if (audio && Number.isFinite(details.seekTime)) audio.currentTime = details.seekTime
    })

    return () => {
      for (const action of ['play', 'pause', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward', 'seekto']) {
        try { session.setActionHandler(action, null) } catch { /* Unsupported action. */ }
      }
    }
  }, [activeTrack, playing, playPrevious, playNext])

  const handleFiles = (event) => {
    const audioExtensions = /\.(mp3|m4a|wav|ogg|oga|aac|flac|opus|weba|aiff?)$/i
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('audio/') || audioExtensions.test(file.name))
    if (!files.length) {
      setNotice('Choose an audio file such as MP3, WAV, OGG or M4A.')
      return
    }
    const newTracks = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist: 'Your library',
      album: 'Local upload',
      genre: 'Uploaded',
      duration: 'Local file',
      cover: ['linear-gradient(135deg,#5f72bd,#9b23ea)', 'linear-gradient(135deg,#11998e,#38ef7d)', 'linear-gradient(135deg,#fc4a1a,#f7b733)'][index % 3],
      url: URL.createObjectURL(file),
      blob: file,
      filename: file.name,
      source: 'upload',
    }))
    newTracks.forEach((track) => objectUrlsRef.current.add(track.url))
    Promise.all(newTracks.map(saveTrackToLibrary)).then(() => setNotice(`${newTracks.length} audio file${newTracks.length > 1 ? 's' : ''} saved in your on-device library.`)).catch(() => setNotice('Audio added for this session, but permanent saving failed. Check available browser storage.'))
    setUploads((previous) => [...newTracks, ...previous])
    setActiveId(newTracks[0].id)
    setPlaying(false)
    setSection('Your uploads')
    event.target.value = ''
  }

  const renameTrack = async (track) => {
    if (track.source !== 'upload') return
    const nextTitle = window.prompt('Enter a new track name:', track.title)?.trim()
    if (!nextTitle || nextTitle === track.title) return
    const updatedTrack = { ...track, title: nextTitle }
    setUploads((items) => items.map((item) => item.id === track.id ? updatedTrack : item))
    try {
      await saveTrackToLibrary(updatedTrack)
      setNotice('Track name updated.')
    } catch {
      setNotice('Track renamed for this session, but the change could not be saved permanently.')
    }
  }

  const deleteTrack = async (track) => {
    if (track.source !== 'upload') return
    if (!window.confirm(`Delete "${track.title}" from Your uploads? This cannot be undone.`)) return
    try {
      await deleteTrackFromLibrary(track.id)
      setUploads((items) => items.filter((item) => item.id !== track.id))
      setLiked((items) => items.filter((id) => id !== track.id))
      if (activeId === track.id) {
        setPlaying(false)
        setActiveId(demoTracks[0].id)
      }
      if (track.url) {
        URL.revokeObjectURL(track.url)
        objectUrlsRef.current.delete(track.url)
      }
      setNotice('Track deleted from your on-device library.')
    } catch {
      setNotice('Could not delete this track. Please try again.')
    }
  }

  const toggleLike = (id) => setLiked((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])
  const downloadTrack = (track) => {
    if (!track) return
    const link = document.createElement('a')
    link.href = track.url
    link.download = track.filename || `${track.title}.mp3`
    link.target = track.source === 'demo' ? '_blank' : '_self'
    if (track.source === 'demo') {
      setNotice('Opening the demo audio source. Download availability depends on the host.')
    }
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <>
      <style>{`
        @keyframes sonoraSectionEnter {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tracks-section { scroll-margin-top: 18px; }
        .tracks-section.section-enter { animation: sonoraSectionEnter 320ms cubic-bezier(.2,.7,.2,1) both; }
        .mobile-nav { display: none; }
        .mobile-nav button { transition: background 180ms ease, border-color 180ms ease, transform 180ms ease; }
        .mobile-nav button:active { transform: scale(.97); }
        .mobile-nav button.active { background: rgba(139,124,255,.2); border-color: rgba(139,124,255,.65); color: #fff; }
        .section-switch-indicator { position: fixed; z-index: 1000; top: 12px; left: 50%; transform: translateX(-50%); padding: 8px 12px; border: 1px solid rgba(139,124,255,.35); border-radius: 999px; background: rgba(20,18,31,.94); color: #eeeaf8; font-size: 12px; box-shadow: 0 8px 28px #0003; pointer-events: none; animation: sonoraSectionEnter 180ms ease both; }
        @media (max-width: 760px) { .mobile-nav { display: flex; gap: 8px; padding: 10px 12px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; background: #101014; border-bottom: 1px solid #ffffff15; } .mobile-nav::-webkit-scrollbar { display: none; } .mobile-nav button { flex: 0 0 auto; padding: 9px 12px; border: 1px solid #ffffff20; border-radius: 9px; background: #ffffff08; color: #eeeaf8; font-size: 12px; white-space: nowrap; } }
        @media (prefers-reduced-motion: reduce) { .tracks-section.section-enter, .section-switch-indicator { animation: none !important; } .mobile-nav button { transition: none; } }
      `}</style>
      <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); navigateToSection('Discover') }}>
          <span className="brand-mark"><AudioLines size={22} /></span>
          <span>sonora<span className="brand-dot">.</span></span>
        </a>
        <div className="side-label">YOUR SPACE</div>
        <nav className="nav-list">
          <button className={`nav-item ${section === 'Discover' ? 'active' : ''}`} onClick={() => navigateToSection('Discover')}><Radio size={18} /> Discover</button>
          <button className={`nav-item ${section === 'Your uploads' ? 'active' : ''}`} onClick={() => navigateToSection('Your uploads')}><ListMusic size={18} /> Your uploads <span className="nav-count">{uploads.length}</span></button>
          <button className={`nav-item ${section === 'Liked' ? 'active' : ''}`} onClick={() => navigateToSection('Liked')}><Heart size={18} /> Liked songs <span className="nav-count">{liked.length}</span></button>
          <button className={`nav-item ${section === 'YouTube links' ? 'active' : ''}`} onClick={() => navigateToSection('YouTube links')}><Radio size={18} /> YouTube links <span className="nav-count">{youtubeItems.length}</span></button>
        </nav>
        <div className="side-label library-label">EXPLORE FREE MUSIC</div>
        <div className="free-links">
          {freeMusicLinks.map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.name}><span>{item.name}</span><ExternalLink size={14} /></a>)}
        </div>
        <div className="sidebar-bottom">
          <div className="mini-wave"><Waves size={18} /><span>Made for your moments</span></div>
          <p>Your uploaded audio is saved locally in this browser. Clearing browser data can remove it.</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><AudioLines size={20} /></span> sonora<span className="brand-dot">.</span></div>
          <div className="search-wrap"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search songs, artists, genres..." aria-label="Search music" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}</div>
          <button className="upload-button" onClick={() => fileInputRef.current?.click()}><Plus size={18} /><span>Add music</span></button>
          <input ref={fileInputRef} className="hidden-input" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac,.opus" multiple onChange={handleFiles} />
          <input ref={backupInputRef} className="hidden-input" type="file" accept="application/json,.json" onChange={importLibraryBackup} />
        </header>

        <nav className="mobile-nav" aria-label="Music sections">
          <button className={section === 'Discover' ? 'active' : ''} aria-current={section === 'Discover' ? 'page' : undefined} onClick={() => navigateToSection('Discover')}>Discover</button>
          <button className={section === 'Your uploads' ? 'active' : ''} aria-current={section === 'Your uploads' ? 'page' : undefined} onClick={() => navigateToSection('Your uploads')}>Uploads <span>({uploads.length})</span></button>
          <button className={section === 'Liked' ? 'active' : ''} aria-current={section === 'Liked' ? 'page' : undefined} onClick={() => navigateToSection('Liked')}>Liked <span>({liked.length})</span></button>
          <button className={section === 'YouTube links' ? 'active' : ''} aria-current={section === 'YouTube links' ? 'page' : undefined} onClick={() => navigateToSection('YouTube links')}>YouTube <span>({youtubeItems.length})</span></button>
        </nav>

        <div className="content-scroll">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><Sparkles size={14} /> YOUR SOUND, YOUR SPACE</div>
              <h1>Find your<br /><span>own rhythm.</span></h1>
              <p>A little more music. A little less noise.<br className="desktop-break" /> Your personal listening space starts here.</p>
              <div className="hero-actions">
                <button className="primary-button" onClick={() => activeTrack && (playing ? setPlaying(false) : setPlaying(true))}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />} {playing ? 'Pause listening' : 'Start listening'}</button>
                <button className="secondary-button" onClick={() => fileInputRef.current?.click()}><Upload size={17} /> Upload audio</button>
              </div>
              <div className="hero-footnote"><span className="status-dot" /> No account needed · Audio is saved in this browser</div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orb orb-one"></div><div className="orb orb-two"></div><div className="orb orb-three"></div>
              <div className="vinyl"><div className="vinyl-groove"></div><div className="vinyl-label"><AudioLines size={25} /></div></div>
              <div className="floating-note note-one">♫</div><div className="floating-note note-two">♪</div>
              <div className="sound-bars">{Array.from({ length: 25 }, (_, i) => <i key={i} style={{ height: `${16 + Math.abs(Math.sin(i * 0.72)) * (i % 4 === 0 ? 58 : 38)}px` }} />)}</div>
            </div>
          </section>

          <section className="quick-stats">
            <div><span className="stat-icon"><Music2 size={17} /></span><span><strong>{allTracks.length}</strong><small>Tracks available</small></span></div>
            <div><span className="stat-icon violet"><Headphones size={17} /></span><span><strong>Ad-free</strong><small>Your own player</small></span></div>
            <div><span className="stat-icon green"><Disc3 size={17} /></span><span><strong>On-device</strong><small>{libraryReady ? 'Saved on this device' : 'Loading library…'}</small></span></div>
          </section>

          <section key={section} className={`tracks-section ${isNavigating ? 'section-enter' : ''}`}>
            <div className="section-heading">
              <div><div className="eyebrow muted">{section === 'Discover' ? 'YOUR NEXT FAVOURITE' : 'YOUR COLLECTION'}</div><h2>{section === 'Discover' ? 'Made for the moment' : section}</h2></div>
              <span className="track-total">{section === 'YouTube links' ? `${youtubeItems.length} links` : `${visibleTracks.length} tracks`}</span>
            </div>
            {section === 'YouTube links' ? <div className="youtube-collection">
              <form className="youtube-import" onSubmit={addYoutubeLink}>
                <div className="youtube-import-heading"><span className="youtube-icon"><Radio size={20} /></span><div><strong>Add a YouTube link</strong><p>Save a video to your collection and play it on YouTube.</p></div></div>
                <div className="youtube-input-row"><input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="Paste YouTube video URL here…" aria-label="YouTube video URL" required /><button className="primary-button" type="submit"><Plus size={16} /> Add link</button></div>
                <p className="youtube-disclaimer">This section saves video links only; it does not save their audio. To build your private music library, download audio you are allowed to use from a free music source, then tap <strong>Add music</strong> and select the file. Uploaded audio is stored on this device in your browser.</p>
              </form>
              {youtubeItems.length ? <div className="youtube-link-list">{youtubeItems.filter((item) => !query.trim() || item.title.toLowerCase().includes(query.toLowerCase()) || item.videoId.toLowerCase().includes(query.toLowerCase())).map((item) => <div className="youtube-link-row" key={item.id}><img src={`https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`} alt="" /><div className="youtube-link-meta"><strong>{item.title}</strong><span>YouTube · Opens in a new tab</span></div><a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Watch Ad-Free Video"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(139, 124, 255, 0.4)',
                    background: 'linear-gradient(135deg, #6555e8, #8b5cf6)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s ease, transform 0.2s ease',
                  }}
                  onMouseEnter={(event) => { event.currentTarget.style.opacity = '0.9'; event.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={(event) => { event.currentTarget.style.opacity = '1'; event.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <ExternalLink size={16} />
                  <span>Watch Ad-Free Video</span>
                </a><button className="icon-button" onClick={() => setYoutubeItems((items) => items.filter((entry) => entry.id !== item.id))} aria-label="Remove YouTube link"><X size={17} /></button></div>)}</div> : <div className="empty-state"><div className="empty-icon"><Radio size={27} /></div><h3>Your saved video links will appear here</h3><p>Paste a YouTube link above to save a shortcut. To save a song itself, upload an audio file.</p></div>}
            </div> : visibleTracks.length ? <div className="track-list">
              <div className="track-head"><span>#</span><span>TRACK</span><span>COLLECTION</span><span>TIME</span><span></span></div>
              {visibleTracks.map((track, index) => (
                <div className={`track-row ${activeId === track.id ? 'selected' : ''}`} key={track.id} onDoubleClick={() => chooseTrack(track)}>
                  <button className="track-number" onClick={() => activeId === track.id ? setPlaying(!playing) : chooseTrack(track)} aria-label={activeId === track.id && playing ? 'Pause track' : `Play ${track.title}`}>
                    {activeId === track.id && playing ? <span className="playing-bars"><i/><i/><i/></span> : activeId === track.id ? <Play size={16} fill="currentColor" /> : <span>{String(index + 1).padStart(2, '0')}</span>}
                  </button>
                  <div className="track-main" onClick={() => chooseTrack(track)}><Cover track={track} /><div className="track-meta"><strong>{track.title}</strong><span>{track.artist}</span></div></div>
                  <div className="track-album">{track.album}</div>
                  <div className="track-duration">{track.duration === 'Sample track' ? '—:—' : track.duration === 'Local file' ? 'Local' : track.duration}</div>
                  <div className="track-actions">
                    <button className={`icon-button like-button ${liked.includes(track.id) ? 'liked' : ''}`} onClick={(event) => { event.stopPropagation(); toggleLike(track.id) }} aria-label="Like track"><Heart size={17} fill={liked.includes(track.id) ? 'currentColor' : 'none'} /></button>
                    <button className="icon-button" onClick={(event) => { event.stopPropagation(); downloadTrack(track) }} aria-label={`Download ${track.title}`}><Download size={17} /></button>
                    {track.source === 'upload' && <>
                      <button className="icon-button" onClick={(event) => { event.stopPropagation(); renameTrack(track) }} aria-label={`Rename ${track.title}`} title="Rename track"><Pencil size={16} /></button>
                      <button className="icon-button" onClick={(event) => { event.stopPropagation(); deleteTrack(track) }} aria-label={`Delete ${track.title}`} title="Delete track"><Trash2 size={16} /></button>
                    </>}
                  </div>
                </div>
              ))}
            </div> : <div className="empty-state"><div className="empty-icon"><Music2 size={28} /></div><h3>{section === 'Liked' ? 'Your favourites live here' : 'No tracks found'}</h3><p>{section === 'Liked' ? 'Tap the heart beside a track to save it here.' : 'Try another search or add audio files from your device.'}</p><button className="secondary-button" onClick={() => fileInputRef.current?.click()}><Plus size={16} /> Add your music</button></div>}
          </section>

          <section className="storage-panel">
            <div className="storage-panel-heading"><span className="storage-icon"><HardDrive size={19} /></span><div><h3>On-device library</h3><p>Your audio stays in this browser on this device.</p></div></div>
            <div className="storage-meter"><div className="storage-meter-label"><span>Browser storage used (estimate)</span><strong>{formatBytes(storageInfo.usage)}{storageInfo.quota ? ` / ${formatBytes(storageInfo.quota)}` : ''}</strong></div><div className="storage-meter-track"><span style={{ width: `${storageInfo.quota ? Math.min(100, (storageInfo.usage / storageInfo.quota) * 100) : 0}%` }} /></div></div>
            <div className="storage-panel-footer"><span><ShieldCheck size={14} /> {storageInfo.persistent ? 'Persistent storage granted' : 'Storage persistence not guaranteed'}</span><div className="storage-actions"><button className="secondary-button" onClick={exportLibraryBackup}><Download size={15} /> Backup</button><button className="secondary-button" onClick={() => backupInputRef.current?.click()}><Upload size={15} /> Restore</button></div></div>
            <p className="storage-note">Browser storage limits vary. Backups include your uploaded audio and collection details; large libraries create large backup files. Browser/site data clearing can still remove the on-device copy.</p>
          </section>

          <section className="free-music-panel">
            <div className="free-panel-icon"><Sparkles size={20} /></div>
            <div className="free-panel-copy"><h3>More music, freely explored.</h3><p>Discover downloadable tracks from music libraries. Always check the license for each track before reusing or sharing it.</p></div>
            <a href="https://mixkit.co/free-stock-music/" target="_blank" rel="noreferrer" className="text-link">Explore music <ExternalLink size={15} /></a>
          </section>
          <footer>SONORA <span>·</span> Your music, your moment. <span className="footer-right">Audio demo tracks are for playback testing.</span></footer>
        </div>
      </main>

      <section className="player-bar">
        <div className="now-playing">
          {activeTrack && <><Cover track={activeTrack} /><div className="now-meta"><strong>{activeTrack.title}</strong><span>{activeTrack.artist}</span></div><button className={`icon-button now-like ${liked.includes(activeTrack.id) ? 'liked' : ''}`} onClick={() => toggleLike(activeTrack.id)} aria-label="Like current track"><Heart size={16} fill={liked.includes(activeTrack.id) ? 'currentColor' : 'none'} /></button></>}
        </div>
        <div className="player-center">
          <div className="player-controls">
            <button className={`control-button ${shuffle ? 'control-active' : ''}`} onClick={() => setShuffle(!shuffle)} aria-label="Toggle shuffle"><Shuffle size={17} /></button>
            <button className="control-button" onClick={playPrevious} aria-label="Previous track"><SkipBack size={19} fill="currentColor" /></button>
            <button className="play-button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button>
            <button className="control-button" onClick={playNext} aria-label="Next track"><SkipForward size={19} fill="currentColor" /></button>
            <button className={`control-button ${repeat ? 'control-active' : ''}`} onClick={() => setRepeat(!repeat)} aria-label="Toggle repeat"><Repeat2 size={17} /></button>
          </div>
          <div className="seek-row"><span>{formatTime(currentTime)}</span><input type="range" min="0" max={duration || 100} value={Math.min(currentTime, duration || 100)} onChange={(e) => { const value = Number(e.target.value); setCurrentTime(value); if (audioRef.current && duration) audioRef.current.currentTime = value }} aria-label="Seek audio" /><span>{formatTime(duration)}</span></div>
        </div>
        <div className="player-options">
          <button className={`enhancer-button ${enhancer ? 'enabled' : ''}`} onClick={() => setEnhancer(!enhancer)} title="Toggle sound enhancer"><Sparkles size={16} /><span>Enhance</span>{enhancer && <Check size={13} />}</button>
          <div className="volume-control"><button className="icon-button" onClick={() => setVolume(volume > 0 ? 0 : 0.78)} aria-label="Toggle mute">{volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</button><input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volume" /></div>
        </div>
      </section>
      <audio ref={audioRef} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} onEnded={() => repeat && audioRef.current ? (audioRef.current.currentTime = 0, audioRef.current.play()) : playNext()} preload="metadata" />
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}
      {isNavigating && <div className="section-switch-indicator" role="status" aria-live="polite">Opening {section}…</div>}
      </div>
    </>
  )
}