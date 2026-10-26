import { useEffect, useMemo, useState } from 'react'
import {
  Youtube, Search, Plus, Play, ExternalLink, Trash2, ListVideo,
  X, Link2, ArrowUpRight, Clock3, Menu
} from 'lucide-react'

const STORAGE_KEY = 'sonora-youtube-links'
const ACTIVE_KEY = 'sonora-active-youtube'
const QUEUE_KEY = 'sonora-youtube-queue'

function getVideoId(input) {
  try {
    const parsed = new URL(input.trim())
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    let id = ''

    if (host === 'youtu.be') {
      id = parsed.pathname.split('/').filter(Boolean)[0] || ''
    } else if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'yout-ube.com' || host.endsWith('.yout-ube.com')) {
      id = parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?]+)/)?.[1] || ''
    }

    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : ''
  } catch {
    return ''
  }
}

// Keep the user's existing appended-link format as the stored URL.
function toAppendedUrl(input) {
  const videoId = getVideoId(input)
  if (!videoId) throw new Error('Invalid YouTube video URL')
  // Normalize watch, Shorts, live and youtu.be links to the app's appended URL format.
  return `https://www.yout-ube.com/watch?v=${videoId}`
}

function readItems() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.filter((item) => item && typeof item.videoId === 'string').map((item) => {
      const originalUrl = item.originalUrl || item.url || `https://www.youtube.com/watch?v=${item.videoId}`
      let appendedUrl = item.url || `https://www.yout-ube.com/watch?v=${item.videoId}`
      try { appendedUrl = toAppendedUrl(appendedUrl) } catch { /* Keep an existing saved URL if parsing fails. */ }
      return {
        id: item.id || `yt-${item.videoId}`,
        videoId: item.videoId,
        url: appendedUrl,
        originalUrl,
        title: item.title || `YouTube video · ${item.videoId}`,
        addedAt: item.addedAt || Date.now(),
      }
    })
  } catch {
    return []
  }
}

export default function App() {
  const [items, setItems] = useState(readItems)
  const [url, setUrl] = useState('')
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || '')
  const [queue, setQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
  })
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
    else localStorage.removeItem(ACTIVE_KEY)
  }, [activeId])
  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  }, [queue])

  const activeItem = useMemo(() => items.find((item) => item.videoId === activeId) || queue.find((item) => item.videoId === activeId), [items, queue, activeId])
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) => item.title.toLowerCase().includes(term) || item.videoId.toLowerCase().includes(term))
  }, [items, search])

  function addLink(event) {
    event.preventDefault()
    const input = url.trim()
    const videoId = getVideoId(input)
    if (!videoId) {
      setNotice('Please paste a valid YouTube video URL.')
      return
    }
    if (items.some((item) => item.videoId === videoId)) {
      setNotice('This video is already saved in your links.')
      setUrl('')
      return
    }
    try {
      const appendedUrl = toAppendedUrl(input)
      const item = {
        id: `yt-${videoId}`,
        videoId,
        url: appendedUrl,
        originalUrl: input,
        title: `YouTube video · ${videoId}`,
        addedAt: Date.now(),
      }
      setItems((current) => [item, ...current])
      setActiveId(videoId)
      setUrl('')
      setNotice('Saved the appended link. It will remain in your list on this browser.')
    } catch {
      setNotice('Could not process this URL. Please check the link and try again.')
    }
  }

  function playNextQueued() {
    if (!queue.length) {
      setNotice('Your queue is empty. Add a saved video to the queue first.')
      return
    }
    const [next, ...remaining] = queue
    setQueue(remaining)
    setActiveId(next.videoId)
  }

  function openSearch() {
    const term = search.trim()
    if (!term) {
      setNotice('Type a video or song to search on YouTube.')
      return
    }
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`, '_blank', 'noopener,noreferrer')
  }

  function addToQueue(item) {
    setQueue((current) => current.some((entry) => entry.videoId === item.videoId)
      ? current
      : [...current, item])
    setNotice('Added to queue.')
  }

  return (
    <div className="yt-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
        :root { color-scheme: dark; font-family: Roboto, Arial, sans-serif; background: #0f0f0f; color: #f1f1f1; }
        * { box-sizing: border-box; }
        body { margin: 0; background: #0f0f0f; }
        button, input { font: inherit; }
        button { cursor: pointer; }
        .yt-app { min-height: 100vh; background: #0f0f0f; color: #f1f1f1; }
        .yt-header { height: 64px; padding: 0 4%; display: flex; align-items: center; gap: 22px; position: sticky; top: 0; z-index: 5; background: #0f0f0f; border-bottom: 1px solid #272727; }
        .yt-brand { display: flex; align-items: center; gap: 8px; color: #f1f1f1; font-weight: 700; font-size: 20px; letter-spacing: -.6px; white-space: nowrap; }
        .yt-brand-icon { color: #ff0033; display: flex; align-items: center; }
        .yt-search { display: flex; width: min(660px, 60vw); margin: 0 auto; height: 40px; }
        .yt-search input { flex: 1; min-width: 0; border: 1px solid #303030; border-right: 0; border-radius: 22px 0 0 22px; background: #121212; padding: 0 18px; color: #f1f1f1; outline: none; }
        .yt-search input:focus { border-color: #1c62b9; }
        .yt-search button { width: 64px; display: grid; place-items: center; border: 1px solid #303030; border-radius: 0 22px 22px 0; background: #222; color: #f1f1f1; }
        .yt-layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); min-height: calc(100vh - 64px); }
        .yt-sidebar { padding: 18px 12px; border-right: 1px solid #272727; }
        .yt-side-button { display: flex; width: 100%; align-items: center; gap: 22px; padding: 12px 16px; border: 0; border-radius: 10px; background: transparent; color: #f1f1f1; text-align: left; }
        .yt-side-button:hover, .yt-side-button.active { background: #272727; }
        .yt-side-note { margin: 22px 14px; color: #aaa; font-size: 12px; line-height: 1.5; }
        .yt-main { width: 100%; max-width: 1600px; padding: 24px clamp(16px, 3vw, 44px) 80px; margin: 0 auto; }
        .yt-pills { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 22px; scrollbar-width: none; }
        .yt-pill { white-space: nowrap; border: 0; border-radius: 8px; padding: 9px 13px; background: #272727; color: #f1f1f1; font-size: 14px; }
        .yt-pill.selected { background: #f1f1f1; color: #0f0f0f; }
        .yt-add-panel { border: 1px solid #303030; border-radius: 16px; padding: 18px; margin-bottom: 26px; background: #161616; }
        .yt-section-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 14px; font-size: 20px; font-weight: 700; }
        .yt-add-form { display: flex; gap: 10px; }
        .yt-add-form input { min-width: 0; flex: 1; border: 1px solid #3f3f3f; border-radius: 10px; padding: 12px 14px; background: #0f0f0f; color: #f1f1f1; outline: none; }
        .yt-red-button { border: 0; border-radius: 10px; padding: 0 16px; min-height: 42px; display: inline-flex; justify-content: center; align-items: center; gap: 8px; background: #ff0033; color: #fff; font-weight: 500; white-space: nowrap; }
        .yt-red-button:hover { background: #cc0029; }
        .yt-subtle { color: #aaa; font-size: 13px; line-height: 1.5; margin: 12px 0 0; }
        .yt-player-section { margin: 0 0 32px; }
        .yt-player-title { font-size: 18px; margin: 0 0 12px; }
        .yt-player { width: 100%; max-width: 1100px; aspect-ratio: 16 / 9; background: #000; overflow: hidden; border-radius: 14px; }
        .yt-player iframe { display: block; width: 100%; height: 100%; border: 0; }
        .yt-player-empty { width: 100%; max-width: 1100px; aspect-ratio: 16 / 9; display: grid; place-items: center; border-radius: 14px; background: #181818; color: #aaa; text-align: center; padding: 24px; }
        .yt-player-empty strong { display: block; color: #f1f1f1; margin: 12px 0 6px; }
        .yt-list-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 0 0 16px; }
        .yt-video-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px 16px; }
        .yt-video-card { min-width: 0; }
        .yt-thumb-wrap { position: relative; overflow: hidden; border-radius: 12px; aspect-ratio: 16 / 9; background: #272727; }
        .yt-thumb { width: 100%; height: 100%; display: block; object-fit: cover; }
        .yt-card-body { display: flex; align-items: flex-start; gap: 10px; padding-top: 12px; }
        .yt-mini-icon { flex: 0 0 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: #272727; color: #ff0033; }
        .yt-card-info { min-width: 0; flex: 1; }
        .yt-card-title { font-size: 15px; line-height: 1.4; font-weight: 500; margin: 0 0 7px; overflow-wrap: anywhere; }
        .yt-card-meta { font-size: 12px; color: #aaa; margin: 0 0 10px; }
        .yt-actions { display: flex; flex-wrap: wrap; gap: 7px; }
        .yt-small-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 10px; border: 0; border-radius: 18px; background: #272727; color: #f1f1f1; font-size: 12px; }
        .yt-small-button:hover { background: #3f3f3f; }
        .yt-small-button.primary { background: #f1f1f1; color: #0f0f0f; }
        .yt-small-button.danger { color: #ff8080; }
        .yt-queue { margin: 24px 0 34px; padding: 16px; border: 1px solid #303030; border-radius: 14px; }
        .yt-queue-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #303030; padding: 11px 0; }
        .yt-queue-row:first-of-type { margin-top: 8px; }
        .yt-queue-name { font-size: 14px; overflow-wrap: anywhere; }
        .yt-empty { padding: 36px 16px; text-align: center; color: #aaa; border: 1px dashed #333; border-radius: 14px; }
        .yt-empty strong { display: block; color: #f1f1f1; margin: 12px 0 6px; }
        .yt-toast { position: fixed; z-index: 10; bottom: 20px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 24px); display: flex; align-items: center; gap: 16px; padding: 12px 16px; background: #272727; border: 1px solid #444; border-radius: 10px; box-shadow: 0 8px 30px #0008; font-size: 14px; }
        .yt-toast button { border: 0; background: transparent; color: #f1f1f1; display: flex; }
        .yt-menu-button { display: none; background: transparent; border: 0; color: #f1f1f1; }
        @media (max-width: 1050px) { .yt-video-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .yt-layout { grid-template-columns: 190px minmax(0, 1fr); } }
        @media (max-width: 700px) { .yt-header { height: 58px; padding: 0 12px; gap: 12px; } .yt-brand { font-size: 17px; } .yt-brand-word { display: none; } .yt-search { width: auto; flex: 1; } .yt-search input { padding: 0 12px; } .yt-search button { width: 46px; } .yt-layout { display: block; min-height: calc(100vh - 58px); } .yt-sidebar { display: ${menuOpen ? 'block' : 'none'}; position: fixed; z-index: 6; top: 58px; left: 0; bottom: 0; width: 230px; background: #0f0f0f; box-shadow: 12px 0 24px #0007; } .yt-menu-button { display: flex; } .yt-main { padding: 16px 12px 60px; } .yt-video-grid { grid-template-columns: 1fr; gap: 28px; } .yt-thumb-wrap { border-radius: 10px; } .yt-add-form { flex-direction: column; } .yt-add-form .yt-red-button { width: 100%; } .yt-player { border-radius: 9px; } .yt-add-panel { padding: 14px; } .yt-section-title { font-size: 18px; } }
      `}</style>

      <header className="yt-header">
        <button className="yt-menu-button" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}><Menu size={22} /></button>
        <div className="yt-brand"><span className="yt-brand-icon"><Youtube size={30} fill="currentColor" /></span><span className="yt-brand-word">Sonora</span></div>
        <form className="yt-search" onSubmit={(event) => { event.preventDefault(); openSearch() }}>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search saved videos or search YouTube" aria-label="Search videos" />
          <button type="submit" aria-label="Search YouTube"><Search size={20} /></button>
        </form>
      </header>

      <div className="yt-layout">
        <aside className="yt-sidebar">
          <button className="yt-side-button active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Play size={20} fill="currentColor" /> Home</button>
          <button className="yt-side-button" onClick={() => document.getElementById('saved-videos')?.scrollIntoView({ behavior: 'smooth' })}><ListVideo size={20} /> Saved videos <span>{items.length}</span></button>
          <button className="yt-side-button" onClick={() => document.getElementById('queue')?.scrollIntoView({ behavior: 'smooth' })}><Clock3 size={20} /> Queue <span>{queue.length}</span></button>
          <p className="yt-side-note">Your saved links are stored in this browser. The embedded player follows YouTube's playback and availability rules.</p>
        </aside>

        <main className="yt-main">
          <div className="yt-pills">
            <button className="yt-pill selected" onClick={() => setSearch('')}>All</button>
            <button className="yt-pill" onClick={() => document.getElementById('add-link')?.scrollIntoView({ behavior: 'smooth' })}>Add link</button>
            <button className="yt-pill" onClick={() => document.getElementById('saved-videos')?.scrollIntoView({ behavior: 'smooth' })}>Saved videos</button>
            <button className="yt-pill" onClick={() => document.getElementById('queue')?.scrollIntoView({ behavior: 'smooth' })}>Queue</button>
          </div>

          <section className="yt-add-panel" id="add-link">
            <h1 className="yt-section-title"><span>Add a YouTube link</span><Link2 size={21} /></h1>
            <form className="yt-add-form" onSubmit={addLink}>
              <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a YouTube video URL here…" aria-label="YouTube video URL" required />
              <button className="yt-red-button" type="submit"><Plus size={18} /> Save link</button>
            </form>
            <p className="yt-subtle">The appended link format is saved when you add the video, so you do not need to append it again. Duplicate video IDs are skipped.</p>
          </section>

          <section className="yt-player-section">
            <h2 className="yt-player-title">{activeItem ? activeItem.title : 'Play a saved video'}</h2>
            {activeId ? (
              <div className="yt-player"><iframe key={activeId} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(activeId)}?autoplay=1&rel=0`} title={activeItem?.title || 'YouTube video player'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
            ) : (
              <div className="yt-player-empty"><div><Youtube size={42} /><strong>Your player is ready</strong><span>Add a link or choose a saved video below.</span></div></div>
            )}
            {activeItem && <p className="yt-subtle">Playing through YouTube's official embedded player. Ads and embedding availability depend on YouTube and the video owner. <a href={activeItem.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3ea6ff' }}>Open appended link <ArrowUpRight size={13} style={{ verticalAlign: 'middle' }} /></a></p>}
          </section>

          {queue.length > 0 && <section className="yt-queue" id="queue">
            <h2 className="yt-section-title">Up next <span style={{ color: '#aaa', fontSize: 14 }}>{queue.length} videos</span></h2>
            {queue.map((item, index) => <div className="yt-queue-row" key={`${item.videoId}-${index}`}><span className="yt-queue-name">{index + 1}. {item.title}</span><div style={{ display: 'flex', gap: 8 }}><button className="yt-small-button primary" onClick={() => { setActiveId(item.videoId); setQueue((current) => current.filter((entry, i) => !(entry.videoId === item.videoId && i === index))) }}><Play size={14} /> Play</button><button className="yt-small-button" aria-label="Remove from queue" onClick={() => setQueue((current) => current.filter((_, i) => i !== index))}><X size={15} /></button></div></div>)}
          </section>}

          <section id="saved-videos">
            <div className="yt-list-heading"><h2 className="yt-section-title" style={{ margin: 0 }}>Saved videos</h2><span style={{ color: '#aaa', fontSize: 13 }}>{filteredItems.length} videos</span></div>
            {filteredItems.length ? <div className="yt-video-grid">{filteredItems.map((item) => <article className="yt-video-card" key={item.id}>
              <div className="yt-thumb-wrap"><img className="yt-thumb" src={`https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`} alt="" loading="lazy" /></div>
              <div className="yt-card-body"><div className="yt-mini-icon"><Youtube size={18} fill="currentColor" /></div><div className="yt-card-info">
                <h3 className="yt-card-title">{item.title}</h3><p className="yt-card-meta">Saved to Sonora · {new Date(item.addedAt).toLocaleDateString()}</p>
                <div className="yt-actions">
                  <button className="yt-small-button primary" onClick={() => setActiveId(item.videoId)}><Play size={14} fill="currentColor" /> Play here</button>
                  <button className="yt-small-button" onClick={() => addToQueue(item)}><Plus size={14} /> Queue</button>
                  <a className="yt-small-button" href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}><ExternalLink size={14} /> Appended link</a>
                  <button className="yt-small-button danger" aria-label="Delete saved video" onClick={() => { setItems((current) => current.filter((entry) => entry.videoId !== item.videoId)); setQueue((current) => current.filter((entry) => entry.videoId !== item.videoId)); if (activeId === item.videoId) setActiveId(''); setNotice('Removed saved video.') }}><Trash2 size={14} /> Remove</button>
                </div>
              </div></div>
            </article>)}</div> : <div className="yt-empty"><Youtube size={36} /><strong>No saved videos yet</strong><span>Paste a YouTube link above to save it here.</span></div>}
          </section>
        </main>
      </div>

      {notice && <div className="yt-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16} /></button></div>}
    </div>
  )
}
