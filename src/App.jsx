import { useEffect, useMemo, useRef, useState } from 'react';
// import { createClient } from '@supabase/supabase-js';  

import { Youtube, Search, Plus, Play, ExternalLink, Trash2, ListVideo, X, Link2, ArrowUpRight, Clock3, Menu, SkipForward, RefreshCw, Copy, Download, Upload, ShieldCheck, Heart, History, Minimize2, Maximize2, Shuffle, Cloud, LogIn, LogOut, ChevronUp, ChevronDown } from 'lucide-react';

const STORAGE_KEY = 'sonora-youtube-links';

const ACTIVE_KEY = 'sonora-active-youtube';

const QUEUE_KEY = 'sonora-youtube-queue';

const MODE_KEY = 'sonora-player-mode';

const DEFAULT_TITLE_PREFIX = 'YouTube video · ';
const FAVORITES_KEY = 'sonora-favorites';
const HISTORY_KEY = 'sonora-watch-history';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function readStoredArray(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}

function getVideoId(input) {

    try {

        const parsed = new URL(input.trim());

        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

        let id = '';

        if (host === 'youtu.be') {

            id = parsed.pathname.split('/').filter(Boolean)[0] || '';

        }

        else if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'yout-ube.com' || host.endsWith('.yout-ube.com')) {

            id = parsed.searchParams.get('v') || parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?]+)/)?.[1] || '';

        }

        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';

    }

    catch {

        return '';

    }

}

// Keep the user's existing appended-link format as the stored URL.

function toAppendedUrl(input) {

    const videoId = getVideoId(input);

    if (!videoId)

        throw new Error('Invalid YouTube video URL');

    // Normalize watch, Shorts, live and youtu.be links to the app's appended URL format.

    return `https://www.yout-ube.com/watch?v=${videoId}`;

}

// Same URL that works in a separate tab is loaded inside the in-app player.

function getPlayerSrc(mode, videoId) {

    if (mode === 'official') {

        return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1`;

    }

    return `https://www.yout-ube.com/watch?v=${videoId}&autoplay=1`;

}

function readItems() {

    try {

        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

        if (!Array.isArray(stored))

            return [];

        return stored.filter((item) => item && typeof item.videoId === 'string').map((item) => {

            const originalUrl = item.originalUrl || item.url || `https://www.youtube.com/watch?v=${item.videoId}`;

            let appendedUrl = item.url || `https://www.yout-ube.com/watch?v=${item.videoId}`;

            try {

                appendedUrl = toAppendedUrl(appendedUrl);

            }

            catch { /* Keep an existing saved URL if parsing fails. */ }

            return {

                id: item.id || `yt-${item.videoId}`,

                videoId: item.videoId,

                url: appendedUrl,

                originalUrl,

                title: item.title || `${DEFAULT_TITLE_PREFIX}${item.videoId}`,

                addedAt: item.addedAt || Date.now(),

            };

        });

    }

    catch {

        return [];

    }

}

export default function App() {

    const [items, setItems] = useState(readItems);

    const [url, setUrl] = useState('');

    const [search, setSearch] = useState('');

    const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) || '');

    const [queue, setQueue] = useState(() => {

        try {

            const stored = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');

            return Array.isArray(stored) ? stored : [];

        }

        catch {

            return [];

        }

    });

    const [mode, setMode] = useState(() => (localStorage.getItem(MODE_KEY) === 'official' ? 'official' : 'adfree'));

    const [reloadKey, setReloadKey] = useState(0);
    const [playerLoading, setPlayerLoading] = useState(false);
    const [miniPlayer, setMiniPlayer] = useState(false);
    const [favorites, setFavorites] = useState(() => readStoredArray(FAVORITES_KEY));
    const [history, setHistory] = useState(() => readStoredArray(HISTORY_KEY));
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [session, setSession] = useState(null);
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [cloudBusy, setCloudBusy] = useState(false);
    const [cloudStatus, setCloudStatus] = useState('');
    const [authMode, setAuthMode] = useState('login');

    const [notice, setNotice] = useState('');
    const [showStartupLoader, setShowStartupLoader] = useState(true);

    const [menuOpen, setMenuOpen] = useState(false);

    const triedTitles = useRef(new Set());

    const importRef = useRef(null);

    useEffect(() => {
        // Brief branded intro on every fresh app load or page refresh.
        const loaderTimer = window.setTimeout(() => setShowStartupLoader(false), 2400);
        return () => window.clearTimeout(loaderTimer);
    }, []);

    useEffect(() => {

        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

    }, [items]);

    useEffect(() => {

        if (activeId)

            localStorage.setItem(ACTIVE_KEY, activeId);

        else

            localStorage.removeItem(ACTIVE_KEY);

    }, [activeId]);

    useEffect(() => {

        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

    }, [queue]);

    useEffect(() => {

        localStorage.setItem(MODE_KEY, mode);

    }, [mode]);

    useEffect(() => {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }, [favorites]);

    useEffect(() => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
    }, [history]);

    useEffect(() => {
        if (!supabase) return undefined;
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
        return () => listener.subscription.unsubscribe();
    }, []);

    // Show the Sonora loading screen whenever a new player URL is requested.
    useEffect(() => {
        setPlayerLoading(Boolean(activeId));
    }, [activeId, mode, reloadKey]);

    // Fetch real video titles (public oEmbed) for items that still have the placeholder title.

    useEffect(() => {

        items

            .filter((item) => item.title.startsWith(DEFAULT_TITLE_PREFIX) && !triedTitles.current.has(item.videoId))

            .forEach((item) => {

            triedTitles.current.add(item.videoId);

            const watchUrl = `https://www.youtube.com/watch?v=${item.videoId}`;

            fetch(`https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`)

                .then((response) => response.json())

                .then((data) => {

                if (!data || typeof data.title !== 'string' || !data.title)

                    return;

                const title = data.title;

                const apply = (list) => list.map((entry) => (entry.videoId === item.videoId ? { ...entry, title } : entry));

                setItems(apply);

                setQueue(apply);

            })

                .catch(() => { });

        });

    }, [items]);

    const activeItem = useMemo(() => items.find((item) => item.videoId === activeId) || queue.find((item) => item.videoId === activeId), [items, queue, activeId]);

    const filteredItems = useMemo(() => {

        const term = search.trim().toLowerCase();

        const base = showFavoritesOnly ? items.filter((item) => favorites.includes(item.videoId)) : items;
        if (!term) return base;
        return base.filter((item) => item.title.toLowerCase().includes(term) || item.videoId.toLowerCase().includes(term));
    }, [items, search, showFavoritesOnly, favorites]);

    function playVideo(videoId) {
        setActiveId(videoId);
        setPlayerLoading(true);
        setMiniPlayer(false);
        const item = items.find((entry) => entry.videoId === videoId) || queue.find((entry) => entry.videoId === videoId);
        if (item) setHistory((current) => [{ ...item, playedAt: Date.now() }, ...current.filter((entry) => entry.videoId !== videoId)].slice(0, 100));
        window.setTimeout(() => document.querySelector('.yt-player-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }

    function toggleFavorite(videoId) {
        setFavorites((current) => current.includes(videoId) ? current.filter((id) => id !== videoId) : [videoId, ...current]);
    }

    function moveQueueItem(index, direction) {
        setQueue((current) => {
            const nextIndex = index + direction;
            if (nextIndex < 0 || nextIndex >= current.length) return current;
            const next = [...current];
            [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
            return next;
        });
    }

    function shuffleQueue() {
        setQueue((current) => {
            const next = [...current];
            for (let i = next.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [next[i], next[j]] = [next[j], next[i]];
            }
            return next;
        });
        setNotice('Queue shuffled.');
    }

    async function handleAuth(event) {
        event.preventDefault();
        if (!supabase) {
            setCloudStatus('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud sync.');
            return;
        }
        setCloudBusy(true);
        setCloudStatus('');
        try {
            const result = authMode === 'signup'
                ? await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword })
                : await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
            if (result.error) throw result.error;
            if (authMode === 'signup' && !result.data.session) {
                setCloudStatus('Account created. Check your email to confirm, then sign in.');
            } else {
                setSession(result.data.session);
                setCloudStatus('Signed in. Select Sync now to sync this library.');
            }
        } catch (error) {
            setCloudStatus(error.message || 'Could not sign in.');
        } finally {
            setCloudBusy(false);
        }
    }

    async function signOutCloud() {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) setCloudStatus(error.message);
        else {
            setSession(null);
            setCloudStatus('Signed out. Your local library remains on this device.');
        }
    }

    async function syncCloud() {
        if (!supabase || !session?.user) {
            setCloudStatus('Set up Supabase and sign in before syncing.');
            return;
        }
        setCloudBusy(true);
        setCloudStatus('');
        try {
            const userId = session.user.id;
            const { data: cloudRow, error: readError } = await supabase.from('sonora_library').select('data').eq('user_id', userId).maybeSingle();
            if (readError) throw readError;
            const cloud = cloudRow?.data || {};
            const mergedItemsMap = new Map([...(cloud.items || []), ...items].map((item) => [item.videoId, item]));
            const mergedItems = [...mergedItemsMap.values()];
            const mergedFavorites = [...new Set([...(cloud.favorites || []), ...favorites])];
            const mergedHistoryMap = new Map([...(cloud.history || []), ...history].map((item) => [item.videoId, item]));
            const mergedHistory = [...mergedHistoryMap.values()].sort((a, b) => (b.playedAt || b.addedAt || 0) - (a.playedAt || a.addedAt || 0)).slice(0, 100);
            const mergedQueueMap = new Map([...(cloud.queue || []), ...queue].map((item) => [item.videoId, item]));
            const mergedQueue = [...mergedQueueMap.values()];
            const payload = { items: mergedItems, favorites: mergedFavorites, history: mergedHistory, queue: mergedQueue, syncedAt: new Date().toISOString() };
            const { error: writeError } = await supabase.from('sonora_library').upsert({ user_id: userId, data: payload }, { onConflict: 'user_id' });
            if (writeError) throw writeError;
            setItems(mergedItems);
            setFavorites(mergedFavorites);
            setHistory(mergedHistory);
            setQueue(mergedQueue);
            setCloudStatus(`Synced ${mergedItems.length} saved videos with this account.`);
        } catch (error) {
            setCloudStatus(error.message || 'Cloud sync failed. Check your Supabase table and policies.');
        } finally {
            setCloudBusy(false);
        }
    }

    function addLink(event) {

        event.preventDefault();

        const input = url.trim();

        const videoId = getVideoId(input);

        if (!videoId) {

            setNotice('Please paste a valid YouTube video URL.');

            return;

        }

        if (items.some((item) => item.videoId === videoId)) {

            setNotice('This video is already saved in your links.');

            setUrl('');

            return;

        }

        try {

            const appendedUrl = toAppendedUrl(input);

            const item = {

                id: `yt-${videoId}`,

                videoId,

                url: appendedUrl,

                originalUrl: input,

                title: `${DEFAULT_TITLE_PREFIX}${videoId}`,

                addedAt: Date.now(),

            };

            setItems((current) => [item, ...current]);

            playVideo(videoId);

            setUrl('');

            setNotice('Saved the appended link. It will remain in your list on this browser.');

        }

        catch {

            setNotice('Could not process this URL. Please check the link and try again.');

        }

    }

    function playNextQueued() {

        if (!queue.length) {

            setNotice('Your queue is empty. Add a saved video to the queue first.');

            return;

        }

        const [next, ...remaining] = queue;

        setQueue(remaining);

        playVideo(next.videoId);

    }

    function openSearch() {

        const term = search.trim();

        if (!term) {

            setNotice('Type a video or song to search on YouTube.');

            return;

        }

        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(term)}`, '_blank', 'noopener,noreferrer');

    }

    function addToQueue(item) {

        setQueue((current) => current.some((entry) => entry.videoId === item.videoId)

            ? current

            : [...current, item]);

        setNotice('Added to queue.');

    }

    function addAllToQueue() {

        setQueue((current) => {

            const have = new Set(current.map((entry) => entry.videoId));

            return [...current, ...filteredItems.filter((item) => !have.has(item.videoId))];

        });

        setNotice('Added all listed videos to the queue.');

    }

    async function copyActiveLink() {

        if (!activeItem)

            return;

        try {

            await navigator.clipboard.writeText(activeItem.url);

            setNotice('Appended link copied.');

        }

        catch {

            setNotice('Could not copy the link. Copy it manually from "Open appended link".');

        }

    }

    function exportBackup() {

        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });

        const link = document.createElement('a');

        link.href = URL.createObjectURL(blob);

        link.download = 'sonora-saved-links.json';

        link.click();

        URL.revokeObjectURL(link.href);

        setNotice('Backup downloaded.');

    }

    async function importBackup(event) {

        const file = event.target.files?.[0];

        event.target.value = '';

        if (!file)

            return;

        try {

            const data = JSON.parse(await file.text());

            if (!Array.isArray(data))

                throw new Error('bad format');

            const incoming = [];

            for (const raw of data) {

                const videoId = typeof raw?.videoId === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(raw.videoId)

                    ? raw.videoId

                    : getVideoId(String(raw?.url || raw?.originalUrl || ''));

                if (!videoId)

                    continue;

                incoming.push({

                    id: `yt-${videoId}`,

                    videoId,

                    url: `https://www.yout-ube.com/watch?v=${videoId}`,

                    originalUrl: String(raw?.originalUrl || raw?.url || `https://www.youtube.com/watch?v=${videoId}`),

                    title: typeof raw?.title === 'string' && raw.title ? raw.title : `${DEFAULT_TITLE_PREFIX}${videoId}`,

                    addedAt: typeof raw?.addedAt === 'number' ? raw.addedAt : Date.now(),

                });

            }

            const have = new Set(items.map((item) => item.videoId));

            const fresh = incoming.filter((item, index) => !have.has(item.videoId) && incoming.findIndex((x) => x.videoId === item.videoId) === index);

            setItems((current) => [...fresh, ...current]);

            setNotice(`Imported ${fresh.length} new video${fresh.length === 1 ? '' : 's'}.`);

        }

        catch {

            setNotice('Could not read that backup file.');

        }

    }

    return (<div className="yt-app">

      <style>{`

        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');

        :root { color-scheme: dark; font-family: Roboto, Arial, sans-serif; background: #0f0f0f; color: #f1f1f1; }

        * { box-sizing: border-box; }

        body { margin: 0; background: #0f0f0f; }

        button, input { font: inherit; }

        button { cursor: pointer; }

        .yt-app { min-height: 100vh; background: #0f0f0f; color: #f1f1f1; }

        .sonora-intro { position: fixed; inset: 0; z-index: 99999; display: grid; place-items: center; overflow: hidden; background: radial-gradient(ellipse at 50% 42%, #241018 0%, #100d15 42%, #050609 100%); transition: opacity .45s ease, visibility .45s ease; }
        .sonora-intro::before, .sonora-intro::after { content: ''; position: absolute; width: min(70vw, 620px); aspect-ratio: 1; border: 1px solid #ff315b22; border-radius: 50%; animation: sonora-orbit 7s linear infinite; }
        .sonora-intro::after { width: min(88vw, 780px); border-color: #4be8ff18; animation-direction: reverse; animation-duration: 11s; }
        .sonora-intro-inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 22px; padding: 24px; text-align: center; }
        .sonora-vinyl-stage { width: 156px; height: 156px; display: grid; place-items: center; perspective: 700px; filter: drop-shadow(0 20px 30px #ff174455); }
        .sonora-vinyl { position: relative; width: 142px; height: 142px; border-radius: 50%; background: repeating-radial-gradient(circle at center, #18191f 0 4px, #2c2d35 5px 6px, #111218 7px 10px); border: 2px solid #45434c; box-shadow: inset 0 0 0 8px #0b0c11, inset 0 0 0 10px #35333b, 0 0 0 5px #ff315b12; transform-style: preserve-3d; animation: sonora-vinyl-spin 3.4s linear infinite, sonora-vinyl-float 2.4s ease-in-out infinite; }
        .sonora-vinyl::before { content: ''; position: absolute; inset: 35px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #ff8b9e, #fa1749 38%, #9a062a 72%, #3b0618); border: 3px solid #f7a0b0; box-shadow: 0 0 22px #ff174477; }
        .sonora-vinyl::after { content: ''; position: absolute; width: 8px; height: 8px; left: calc(50% - 4px); top: calc(50% - 4px); border-radius: 50%; background: #f5e9ee; box-shadow: 0 0 6px #fff; }
        .sonora-loader-orbit { position: absolute; width: 154px; height: 154px; border: 2px solid transparent; border-top-color: #ff315b; border-right-color: #45e7ff; border-radius: 50%; transform: rotateX(64deg) rotateZ(-20deg); animation: sonora-orbit 1.4s linear infinite; }
        .sonora-intro-name { margin: 0; color: #fff; font-size: clamp(30px, 6vw, 43px); font-weight: 800; letter-spacing: .22em; text-indent: .22em; text-shadow: 0 0 26px #ff315b66; }
        .sonora-intro-tagline { margin: -13px 0 0; color: #b9b5c4; font-size: 12px; letter-spacing: .22em; text-transform: uppercase; }
        .sonora-equalizer { height: 26px; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .sonora-equalizer span { width: 4px; height: 7px; border-radius: 5px; background: linear-gradient(180deg, #53edff, #ff315b); box-shadow: 0 0 10px #ff315b55; animation: sonora-bars .72s ease-in-out infinite alternate; }
        .sonora-equalizer span:nth-child(2n) { animation-delay: .18s; }
        .sonora-equalizer span:nth-child(3n) { animation-delay: .34s; }
        .sonora-loading-caption { margin: -13px 0 0; color: #777483; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
        @keyframes sonora-vinyl-spin { from { rotate: 0deg; } to { rotate: 360deg; } }
        @keyframes sonora-vinyl-float { 0%,100% { translate: 0 0; } 50% { translate: 0 -5px; } }
        @keyframes sonora-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sonora-bars { from { height: 5px; opacity: .65; } to { height: 24px; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .sonora-vinyl, .sonora-loader-orbit, .sonora-intro::before, .sonora-intro::after, .sonora-equalizer span { animation-duration: 2.5s; } }

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

        .yt-player { position: relative; width: 100%; max-width: 1100px; aspect-ratio: 16 / 9; background: #000; overflow: hidden; border-radius: 14px; }
        .yt-loading-overlay { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 20px; background: #0b0b0b; color: #f1f1f1; text-align: center; }
        .yt-loader-spinner { width: 42px; height: 42px; border: 4px solid #454545; border-top-color: #ff0033; border-radius: 50%; animation: sonora-spin .8s linear infinite; }
        .yt-loading-title { font-size: 16px; font-weight: 700; }
        .yt-loading-subtitle { color: #aaa; font-size: 13px; }
        @keyframes sonora-spin { to { transform: rotate(360deg); } }

        .yt-player iframe { display: block; width: 100%; height: 100%; border: 0; }
        .yt-player:fullscreen { width: 100vw; height: 100vh; max-width: none; aspect-ratio: auto; border-radius: 0; background: #000; }
        .yt-player:fullscreen .yt-player-frame { width: 100%; height: 100%; }
        .yt-player:fullscreen iframe { width: 100%; height: 100%; }

        .yt-player-empty { width: 100%; max-width: 1100px; aspect-ratio: 16 / 9; display: grid; place-items: center; border-radius: 14px; background: #181818; color: #aaa; text-align: center; padding: 24px; }

        .yt-player-empty strong { display: block; color: #f1f1f1; margin: 12px 0 6px; }

        .yt-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 1100px; margin: 12px 0 0; }

        .yt-seg { display: inline-flex; border-radius: 18px; overflow: hidden; background: #272727; }

        .yt-seg button { border: 0; background: transparent; color: #f1f1f1; padding: 7px 12px; font-size: 12px; }

        .yt-seg button.on { background: #f1f1f1; color: #0f0f0f; }

        .yt-list-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 0 0 16px; }

        .yt-list-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

        .yt-video-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px 16px; }

        .yt-video-card { min-width: 0; }

        .yt-thumb-wrap { position: relative; overflow: hidden; border-radius: 12px; aspect-ratio: 16 / 9; background: #272727; cursor: pointer; border: 0; padding: 0; width: 100%; display: block; text-align: left; }

        .yt-thumb-wrap:focus-visible { outline: 2px solid #3ea6ff; outline-offset: 3px; }

        .yt-thumb-overlay { position: absolute; inset: 0; display: grid; place-items: center; background: #0000; transition: background .18s ease; }

        .yt-thumb-wrap:hover .yt-thumb-overlay { background: #0006; }

        .yt-playing-badge { display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border-radius: 999px; background: #ff0033; color: white; font-size: 12px; font-weight: 700; box-shadow: 0 4px 18px #0008; }

        .yt-playing-badge svg { animation: sonora-pulse 1.25s ease-in-out infinite; }

        @keyframes sonora-pulse { 50% { opacity: .45; transform: scale(.9); } }

        .yt-player.yt-mini-player { position: fixed; z-index: 20; right: 18px; bottom: 18px; width: min(360px, calc(100vw - 24px)); max-width: none; aspect-ratio: 16 / 9; box-shadow: 0 12px 36px #000b; border: 1px solid #444; }
        .yt-mini-controls { display: none; position: absolute; z-index: 4; top: 8px; right: 8px; gap: 6px; }
        .yt-player.yt-mini-player .yt-mini-controls { display: flex; }
        .yt-mini-controls button { border: 0; border-radius: 18px; background: #171717e8; color: #fff; padding: 7px; display: grid; place-items: center; }
        .yt-cloud-panel { border: 1px solid #303030; border-radius: 14px; background: #161616; padding: 16px; margin: 24px 0; }
        .yt-cloud-form { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
        .yt-cloud-form input { flex: 1; min-width: 160px; border: 1px solid #3f3f3f; border-radius: 9px; padding: 10px 12px; background: #0f0f0f; color: #f1f1f1; }
        .yt-cloud-status { color: #aaa; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
        .yt-history-list { margin-top: 10px; border-top: 1px solid #303030; }
        .yt-history-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #303030; }
        .yt-player-frame { position: relative; width: 100%; height: 100%; }

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



      {showStartupLoader && <div className="sonora-intro" role="status" aria-label="Sonora is loading">
        <div className="sonora-intro-inner">
          <div className="sonora-vinyl-stage" aria-hidden="true">
            <div className="sonora-loader-orbit" />
            <div className="sonora-vinyl" />
          </div>
          <h1 className="sonora-intro-name">SONORA</h1>
          <p className="sonora-intro-tagline">Your sound. Your space.</p>
          <div className="sonora-equalizer" aria-hidden="true">{Array.from({ length: 17 }, (_, index) => <span key={index} />)}</div>
          <p className="sonora-loading-caption">Warming up your music universe</p>
        </div>
      </div>}

      <header className="yt-header">

        <button className="yt-menu-button" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}><Menu size={22}/></button>

        <div className="yt-brand"><span className="yt-brand-icon"><Youtube size={30} fill="currentColor"/></span><span className="yt-brand-word">Sonora</span></div>

        <form className="yt-search" onSubmit={(event) => { event.preventDefault(); openSearch(); }}>

          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search saved videos or search YouTube" aria-label="Search videos"/>

          <button type="submit" aria-label="Search YouTube"><Search size={20}/></button>

        </form>

      </header>



      <div className="yt-layout">

        <aside className="yt-sidebar">

          <button className="yt-side-button active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Play size={20} fill="currentColor"/> Home</button>

          <button className="yt-side-button" onClick={() => document.getElementById('saved-videos')?.scrollIntoView({ behavior: 'smooth' })}><ListVideo size={20}/> Saved videos <span>{items.length}</span></button>

          <button className="yt-side-button" onClick={() => document.getElementById('queue')?.scrollIntoView({ behavior: 'smooth' })}><Clock3 size={20}/> Queue <span>{queue.length}</span></button>
          <button className="yt-side-button" onClick={() => document.getElementById('cloud-sync')?.scrollIntoView({ behavior: 'smooth' })}><Cloud size={20}/> Cloud sync</button>

          <p className="yt-side-note">Your library is stored locally. Optional cloud sync requires your own Supabase setup. Playback behavior depends on the external player.</p>

        </aside>



        <main className="yt-main">

          <div className="yt-pills">

            <button className="yt-pill selected" onClick={() => setSearch('')}>All</button>

            <button className="yt-pill" onClick={() => document.getElementById('add-link')?.scrollIntoView({ behavior: 'smooth' })}>Add link</button>

            <button className="yt-pill" onClick={() => document.getElementById('saved-videos')?.scrollIntoView({ behavior: 'smooth' })}>Saved videos</button>

            <button className="yt-pill" onClick={() => { setShowFavoritesOnly((value) => !value); setShowHistory(false); }}>{showFavoritesOnly ? 'All videos' : 'Favorites'}</button>
            <button className="yt-pill" onClick={() => setShowHistory((value) => !value)}>Watch history</button>
            <button className="yt-pill" onClick={() => document.getElementById('queue')?.scrollIntoView({ behavior: 'smooth' })}>Queue</button>

          </div>



          <section className="yt-add-panel" id="add-link">

            <h1 className="yt-section-title"><span>Add a YouTube link</span><Link2 size={21}/></h1>

            <form className="yt-add-form" onSubmit={addLink}>

              <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a YouTube video URL here…" aria-label="YouTube video URL" required/>

              <button className="yt-red-button" type="submit"><Plus size={18}/> Save link</button>

            </form>

          </section>



          <section className="yt-player-section">

            <h2 className="yt-player-title">{activeItem ? activeItem.title : 'Play a saved video'}</h2>

            {activeId ? (<div className={`yt-player ${miniPlayer ? 'yt-mini-player' : ''}`}>
                <div className="yt-mini-controls">
                  <button onClick={() => setMiniPlayer(false)} aria-label="Expand player" title="Expand player"><Maximize2 size={16}/></button>
                  <button onClick={() => { setActiveId(''); setMiniPlayer(false); }} aria-label="Close mini player" title="Close player"><X size={16}/></button>
                </div>
                <div className="yt-player-frame">

                  <iframe
                    key={`${mode}-${activeId}-${reloadKey}`}
                    src={getPlayerSrc(mode, activeId)}
                    title={activeItem ? activeItem.title : 'Sonora player'}
                    onLoad={() => setPlayerLoading(false)}
                    allow="fullscreen *; autoplay *; encrypted-media *; picture-in-picture *"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                    {playerLoading && (
                      <div className="yt-loading-overlay" role="status" aria-live="polite">
                        <span className="yt-loader-spinner" aria-hidden="true" />
                        <span className="yt-loading-title">This video is loading on SONORA APP</span>
                        <span className="yt-loading-subtitle">Please wait while the player loads…</span>
                      </div>
                    )}

                </div>

              </div>) : (<div className="yt-player-empty"><div><Youtube size={42}/><strong>Your player is ready</strong><span>Add a link or choose a saved video below.</span></div></div>)}



            <div className="yt-toolbar">

              <div className="yt-seg" role="group" aria-label="Player mode">

                <button className={mode === 'adfree' ? 'on' : ''} onClick={() => setMode('adfree')}><ShieldCheck size={13} style={{ verticalAlign: 'middle' }}/> Ad-free site</button>

                {/* <button className={mode === 'official' ? 'on' : ''} onClick={() => setMode('official')}>YouTube embed</button> */}

              </div>

              <button className="yt-small-button" onClick={playNextQueued}><SkipForward size={14}/> Next in queue</button>

              {activeId && <button className="yt-small-button" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw size={14}/> Reload player</button>}

              {activeId && <button className="yt-small-button" onClick={async () => { const player = document.querySelector('.yt-player'); if (!player) return; try { if (document.fullscreenElement) { await document.exitFullscreen(); } else if (player.requestFullscreen) { await player.requestFullscreen(); } } catch (error) { console.error('Fullscreen could not be opened:', error); } }}><Maximize2 size={14}/> Full screen</button>}

              {activeItem && <button className="yt-small-button" onClick={() => setMiniPlayer((value) => !value)}>{miniPlayer ? <Maximize2 size={14}/> : <Minimize2 size={14}/>} {miniPlayer ? 'Expand player' : 'Mini player'}</button>}
              {activeItem && <button className="yt-small-button" onClick={copyActiveLink}><Copy size={14}/> Copy link</button>}

            </div>



            {/* {activeItem && <p className="yt-subtle">If the player stays blank, the site may block embedding: switch the player mode, reload, or <a href={activeItem.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3ea6ff' }}>open appended link <ArrowUpRight size={13} style={{ verticalAlign: 'middle' }}/></a>. Note: auto-play of the next queued video is not possible with an embedded third-party site, so use "Next in queue".</p>} */}

          </section>



          <section className="yt-cloud-panel" id="cloud-sync">
            <h2 className="yt-section-title"><span><Cloud size={20} style={{ verticalAlign: 'middle', marginRight: 8 }}/>Cloud sync</span><span style={{ color: '#aaa', fontSize: 12 }}>{session?.user?.email || 'Not signed in'}</span></h2>
            {!supabase ? (
              <p className="yt-cloud-status">Cloud sync needs a Supabase project. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then restart Vite. Your library still works locally without this setup.</p>
            ) : session ? (
              <>
                <p className="yt-cloud-status">Sync saved videos, favorites, watch history and queue across devices using the same account.</p>
                <div className="yt-cloud-form"><button className="yt-red-button" onClick={syncCloud} disabled={cloudBusy}><Cloud size={15}/>{cloudBusy ? 'Syncing…' : 'Sync now'}</button><button className="yt-small-button" onClick={signOutCloud}><LogOut size={14}/> Sign out</button></div>
              </>
            ) : (
              <form className="yt-cloud-form" onSubmit={handleAuth}>
                <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email address" required aria-label="Cloud sync email"/>
                <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password (at least 6 characters)" minLength={6} required aria-label="Cloud sync password"/>
                <button className="yt-red-button" type="submit" disabled={cloudBusy}><LogIn size={14}/>{cloudBusy ? 'Please wait…' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button>
                <button className="yt-small-button" type="button" onClick={() => setAuthMode((value) => value === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? 'Create account' : 'I already have an account'}</button>
              </form>
            )}
            {cloudStatus && <p className="yt-cloud-status" role="status">{cloudStatus}</p>}
          </section>

          {showHistory && <section className="yt-queue">
            <h2 className="yt-section-title"><span><History size={20} style={{ verticalAlign: 'middle', marginRight: 8 }}/>Recently played</span><button className="yt-small-button danger" onClick={() => { setHistory([]); setNotice('Watch history cleared.'); }}>Clear history</button></h2>
            {history.length ? <div className="yt-history-list">{history.slice(0, 20).map((item) => <div className="yt-history-row" key={item.videoId}><span className="yt-queue-name">{item.title}</span><button className="yt-small-button primary" onClick={() => playVideo(item.videoId)}><Play size={14}/> Play</button></div>)}</div> : <p className="yt-cloud-status">Videos you play will appear here.</p>}
          </section>}

          {queue.length > 0 && <section className="yt-queue" id="queue">

            <h2 className="yt-section-title"><span>Up next <span style={{ color: '#aaa', fontSize: 14 }}>{queue.length} videos</span></span><span style={{ display: 'flex', gap: 8 }}><button className="yt-small-button" onClick={shuffleQueue}><Shuffle size={14}/> Shuffle</button><button className="yt-small-button danger" onClick={() => setQueue([])}><Trash2 size={14}/> Clear queue</button></span></h2>

            {queue.map((item, index) => <div className="yt-queue-row" key={`${item.videoId}-${index}`}><span className="yt-queue-name">{index + 1}. {item.title}</span><div style={{ display: 'flex', gap: 6 }}><button className="yt-small-button" disabled={index === 0} onClick={() => moveQueueItem(index, -1)} aria-label="Move up"><ChevronUp size={14}/></button><button className="yt-small-button" disabled={index === queue.length - 1} onClick={() => moveQueueItem(index, 1)} aria-label="Move down"><ChevronDown size={14}/></button><button className="yt-small-button primary" onClick={() => { playVideo(item.videoId); setQueue((current) => current.filter((entry, i) => !(entry.videoId === item.videoId && i === index))); }}><Play size={14}/> Play</button><button className="yt-small-button" aria-label="Remove from queue" onClick={() => setQueue((current) => current.filter((_, i) => i !== index))}><X size={15}/></button></div></div>)}

          </section>}



          <section id="saved-videos">

            <div className="yt-list-heading">

              <h2 className="yt-section-title" style={{ margin: 0 }}>Saved videos</h2>

              <div className="yt-list-tools">

                <span style={{ color: '#aaa', fontSize: 13 }}>{filteredItems.length} videos</span>

                <button className="yt-small-button" onClick={addAllToQueue} disabled={!filteredItems.length}><Plus size={14}/> Queue all</button>

                <button className="yt-small-button" onClick={exportBackup} disabled={!items.length}><Download size={14}/> Backup</button>

                <button className="yt-small-button" onClick={() => importRef.current?.click()}><Upload size={14}/> Import</button>

                <input ref={importRef} type="file" accept="application/json,.json" onChange={importBackup} style={{ display: 'none' }}/>

              </div>

            </div>

            {filteredItems.length ? <div className="yt-video-grid">{filteredItems.map((item) => <article className="yt-video-card" key={item.id}>

              <button className="yt-thumb-wrap" onClick={() => playVideo(item.videoId)} aria-label={activeId === item.videoId ? `Now playing ${item.title}` : `Play ${item.title}`}>

                <img className="yt-thumb" src={`https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`} alt="" loading="lazy"/>

                <span className="yt-thumb-overlay">{activeId === item.videoId ? <span className="yt-playing-badge"><Play size={14} fill="currentColor"/> PLAYING</span> : <Play size={42} fill="white" color="white"/>}</span>

              </button>

              <div className="yt-card-body"><div className="yt-mini-icon"><Youtube size={18} fill="currentColor"/></div><div className="yt-card-info">

                <h3 className="yt-card-title">{item.title}</h3><p className="yt-card-meta">Saved to Sonora · {new Date(item.addedAt).toLocaleDateString()}</p>

                <div className="yt-actions">

                  <button className="yt-small-button" onClick={() => toggleFavorite(item.videoId)} aria-label={favorites.includes(item.videoId) ? 'Remove from favorites' : 'Add to favorites'}><Heart size={14} fill={favorites.includes(item.videoId) ? 'currentColor' : 'none'}/> {favorites.includes(item.videoId) ? 'Favorited' : 'Favorite'}</button>
                  <button className="yt-small-button" onClick={() => addToQueue(item)}><Plus size={14}/> Queue</button>

                  <a className="yt-small-button" href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}><ExternalLink size={14}/> Appended link</a>

                  <button className="yt-small-button danger" aria-label="Delete saved video" onClick={() => { setItems((current) => current.filter((entry) => entry.videoId !== item.videoId)); setQueue((current) => current.filter((entry) => entry.videoId !== item.videoId)); if (activeId === item.videoId)

                setActiveId(''); setNotice('Removed saved video.'); }}><Trash2 size={14}/> Remove</button>

                </div>

              </div></div>

            </article>)}</div> : <div className="yt-empty"><Youtube size={36}/><strong>No saved videos yet</strong><span>Paste a YouTube link above to save it here.</span></div>}

          </section>

        </main>

      </div>



      {notice && <div className="yt-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16}/></button></div>}

    </div>);

}
