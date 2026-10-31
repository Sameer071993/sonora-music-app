import { useEffect, useMemo, useRef, useState } from 'react';
// import { createClient } from '@supabase/supabase-js';

import { Youtube, Search, Plus, Play, ExternalLink, Trash2, ListVideo, X, Link2, ArrowUpRight, Clock3, Menu, SkipForward, RefreshCw, Copy, Download, Upload, ShieldCheck, Heart, History, Minimize2, Maximize2, Shuffle, Cloud, LogIn, LogOut, ChevronUp, ChevronDown, Library, FolderPlus, ListPlus, PictureInPicture2, Fullscreen, Lock, Unlock, RotateCcw } from 'lucide-react';

const STORAGE_KEY = 'sonora-youtube-links';

const ACTIVE_KEY = 'sonora-active-youtube';

const QUEUE_KEY = 'sonora-youtube-queue';

const MODE_KEY = 'sonora-player-mode';

const DEFAULT_TITLE_PREFIX = 'YouTube video · ';
const FAVORITES_KEY = 'sonora-favorites';
const HISTORY_KEY = 'sonora-watch-history';
const LIBRARIES_KEY = 'sonora-libraries-draft'; // admin's unpublished working copy (this browser only)
const ADMIN_FLAG_KEY = 'sonora-admin-session';
const DEFAULT_LIBRARY_NAME = 'Mostly Viewed';
/*
  Libraries are front-end only. Everyone sees the libraries shipped in public/libraries.json.
  Admin mode (unlocked with VITE_ADMIN_PASSWORD from your .env) lets you create/edit libraries as a local draft;
  use the Export icon, replace public/libraries.json with the downloaded file, and deploy.
  The password is only a convenience gate: it can be read from the built JS, but that is harmless because nothing
  the admin changes reaches other users until you deploy the exported file yourself.
*/
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';
const LIBRARIES_URL = `${import.meta.env.BASE_URL}libraries.json`;
const SLOW_LOAD_HINT_MS = 10000; // show "click Reload player" hint after 10 seconds
const AUTO_RELOAD_MS = 60000; // auto-trigger Reload player after 1 minute
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
    const [slowLoad, setSlowLoad] = useState(false);
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
    const [libraries, setLibraries] = useState([]);
    const [newLibraryName, setNewLibraryName] = useState('');
    const [targetLibraryId, setTargetLibraryId] = useState('');
    const [isAdmin, setIsAdmin] = useState(() => sessionStorage.getItem(ADMIN_FLAG_KEY) === '1');
    const [showAdminLogin, setShowAdminLogin] = useState(false);
    const [adminPassword, setAdminPassword] = useState('');
    const [libraryLink, setLibraryLink] = useState('');

    const [notice, setNotice] = useState('');
    const [showStartupLoader, setShowStartupLoader] = useState(true);

    const [navPill, setNavPill] = useState('all'); // last clicked top pill (stays highlighted)
    const [librarySearch, setLibrarySearch] = useState('');

    const triedTitles = useRef(new Set());

    const importRef = useRef(null);

    useEffect(() => {
        // Brief branded intro on every fresh app load or page refresh.
        const loaderTimer = window.setTimeout(() => setShowStartupLoader(false), 600);
        return () => window.clearTimeout(loaderTimer);
    }, []);

    useEffect(() => {
        // Give the clicked button focus on every browser (Safari/iOS don't do it by default),
        // so the highlighted colour stays on it until another element is clicked.
        const focusClicked = (event) => {
            const button = event.target.closest ? event.target.closest('button') : null;
            if (button && !button.disabled) button.focus({ preventScroll: true });
        };
        document.addEventListener('click', focusClicked);
        return () => document.removeEventListener('click', focusClicked);
    }, []);

    useEffect(() => {
        // Android may send the shared URL as `url`, as part of `text`, or
        // embedded in another share field. Read every query value so browser
        // and Android variations are handled consistently.
        const params = new URLSearchParams(window.location.search);
        const sharedValues = Array.from(params.values()).filter(Boolean);

        const extractCandidates = (value) => {
            const normalized = String(value)
                .replace(/&amp;/gi, '&')
                .replace(/\\u0026/gi, '&');
            const matches = normalized.match(
                /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|yout-ube\.com)\/[^\s<>"'`]+/gi,
            ) || [];

            return matches.map((candidate) => {
                const cleaned = candidate.replace(/[),.;!?\]}]+$/, '');
                return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
            });
        };

        const sharedCandidates = sharedValues.flatMap(extractCandidates);
        const receivedLink = sharedCandidates.find((candidate) => getVideoId(candidate));

        if (receivedLink) {
            setUrl(receivedLink);
            setNotice('YouTube link received from Share. Review it, then tap Save link.');
            window.setTimeout(() => {
                document.getElementById('add-link')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }, 250);
        } else if (sharedValues.length) {
            setNotice('Share opened Sonora, but the shared text did not contain a recognised YouTube URL.');
        }

        // Clear only the one-time share query after processing it.
        if (window.location.search) {
            window.history.replaceState(
                window.history.state,
                '',
                `${window.location.pathname}${window.location.hash}`,
            );
        }
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
        loadLibraries();
    }, [isAdmin]);

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

    // Slow-load helper: after 10s show a "click Reload player" hint, and after
    // 1 minute trigger the same action as the Reload player button automatically.
    // The timers restart on every (re)load and are cancelled once the player loads.
    useEffect(() => {
        setSlowLoad(false);
        if (!playerLoading || !activeId) return undefined;
        const hintTimer = window.setTimeout(() => setSlowLoad(true), SLOW_LOAD_HINT_MS);
        const reloadTimer = window.setTimeout(() => {
            setNotice('The video took more than a minute to load, so the player was reloaded automatically.');
            setReloadKey((key) => key + 1);
        }, AUTO_RELOAD_MS);
        return () => {
            window.clearTimeout(hintTimer);
            window.clearTimeout(reloadTimer);
        };
    }, [playerLoading, activeId, mode, reloadKey]);

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

    const activeItem = useMemo(() => items.find((item) => item.videoId === activeId) || queue.find((item) => item.videoId === activeId) || libraries.flatMap((lib) => lib.videos || []).find((item) => item.videoId === activeId), [items, queue, libraries, activeId]);

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
        const item = items.find((entry) => entry.videoId === videoId) || queue.find((entry) => entry.videoId === videoId) || libraries.flatMap((lib) => lib.videos || []).find((entry) => entry.videoId === videoId);
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

    const activeTargetId = libraries.some((lib) => lib.id === targetLibraryId) ? targetLibraryId : (libraries[0]?.id || '');

    // Library tab that is currently open, and its videos filtered by the library search box.
    const shownLib = libraries.find((lib) => lib.id === activeTargetId);
    const libTerm = librarySearch.trim().toLowerCase();
    const shownVideos = shownLib ? shownLib.videos.filter((video) => !libTerm || video.title.toLowerCase().includes(libTerm) || video.videoId.toLowerCase().includes(libTerm)) : [];

    function cleanLibraries(list) {
        return (Array.isArray(list) ? list : [])
            .filter((lib) => lib && typeof lib.name === 'string' && lib.name)
            .map((lib, index) => ({
                id: lib.id || `lib-${index}-${lib.name}`,
                name: lib.name,
                videos: Array.isArray(lib.videos) ? lib.videos.filter((video) => video && typeof video.videoId === 'string') : [],
                createdAt: lib.createdAt || Date.now(),
            }));
    }

    // Everyone sees the libraries shipped with the app (public/libraries.json). Admin changes stay a local draft
    // (this browser only) until you export libraries.json and deploy it with the code.
    async function loadLibraries() {
        let published = [];
        try {
            const response = await fetch(LIBRARIES_URL, { cache: 'no-store' });
            published = response.ok ? cleanLibraries(await response.json()) : [];
        } catch {
            published = [];
        }
        let next = published;
        if (isAdmin) {
            const draft = cleanLibraries(readStoredArray(LIBRARIES_KEY));
            if (draft.length) next = draft;
            else if (!published.length) next = [{ id: 'mostly-viewed', name: DEFAULT_LIBRARY_NAME, videos: [], createdAt: Date.now() }];
        }
        setLibraries(next);
    }

    function commitLibraries(next) {
        setLibraries(next);
        if (isAdmin) localStorage.setItem(LIBRARIES_KEY, JSON.stringify(next));
    }

    function unlockAdmin(event) {
        event.preventDefault();
        if (!ADMIN_PASSWORD) {
            setNotice('Admin password is not set. Add VITE_ADMIN_PASSWORD to your .env file and restart Vite.');
            return;
        }
        if (adminPassword !== ADMIN_PASSWORD) {
            setNotice('Incorrect admin password.');
            return;
        }
        sessionStorage.setItem(ADMIN_FLAG_KEY, '1');
        setIsAdmin(true);
        setAdminPassword('');
        setShowAdminLogin(false);
        setNotice('Admin mode on. Your changes are a draft until you export libraries.json and deploy it.');
    }

    function lockAdmin() {
        sessionStorage.removeItem(ADMIN_FLAG_KEY);
        setIsAdmin(false);
        setShowAdminLogin(false);
        setNotice('Admin mode off.');
    }

    function createLibrary(event) {
        event.preventDefault();
        const name = newLibraryName.trim();
        if (!name || !isAdmin) return;
        if (libraries.some((lib) => lib.name.toLowerCase() === name.toLowerCase())) {
            setNotice('A library with this name already exists.');
            return;
        }
        const created = { id: `lib-${Date.now()}`, name, videos: [], createdAt: Date.now() };
        commitLibraries([...libraries, created]);
        setTargetLibraryId(created.id);
        setNewLibraryName('');
        setNotice(`Library "${name}" created.`);
    }

    function addToLibrary(item) {
        if (!isAdmin) return;
        const target = libraries.find((lib) => lib.id === activeTargetId);
        if (!target) {
            setNotice('Create a library first.');
            return;
        }
        if (target.videos.some((video) => video.videoId === item.videoId)) {
            setNotice(`Already in "${target.name}".`);
            return;
        }
        const video = { id: item.id, videoId: item.videoId, url: item.url, originalUrl: item.originalUrl, title: item.title, addedAt: item.addedAt };
        commitLibraries(libraries.map((lib) => (lib.id === target.id ? { ...lib, videos: [...lib.videos, video] } : lib)));
        setNotice(`Added to "${target.name}".`);
    }

    function removeFromLibrary(libraryId, videoId) {
        if (!isAdmin) return;
        commitLibraries(libraries.map((lib) => (lib.id === libraryId ? { ...lib, videos: lib.videos.filter((video) => video.videoId !== videoId) } : lib)));
        setNotice('Removed from library.');
    }

    function deleteLibrary(libraryId) {
        const lib = libraries.find((entry) => entry.id === libraryId);
        if (!lib || !isAdmin) return;
        if (!window.confirm(`Delete the library "${lib.name}"?`)) return;
        commitLibraries(libraries.filter((entry) => entry.id !== libraryId));
        setNotice(`Library "${lib.name}" deleted.`);
    }

    // Paste one or many YouTube links (one per line, or separated by spaces/commas) and add them all to the selected library.
    function addLinkToLibrary(event) {
        event.preventDefault();
        if (!isAdmin) return;
        const target = libraries.find((lib) => lib.id === activeTargetId);
        if (!target) {
            setNotice('Create a library first.');
            return;
        }
        const matches = libraryLink.match(/(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|yout-ube\.com)\/[^\s<>"'`,]+/gi) || [];
        const seen = new Set(target.videos.map((video) => video.videoId));
        const fresh = [];
        let duplicates = 0;
        matches.forEach((raw) => {
            const cleaned = raw.replace(/[),.;!?\]}]+$/, '');
            const link = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
            const videoId = getVideoId(link);
            if (!videoId) return;
            if (seen.has(videoId)) {
                duplicates += 1;
                return;
            }
            seen.add(videoId);
            fresh.push({ id: `yt-${videoId}`, videoId, url: toAppendedUrl(link), originalUrl: link, title: `${DEFAULT_TITLE_PREFIX}${videoId}`, addedAt: Date.now() + fresh.length });
        });
        if (!fresh.length) {
            if (duplicates) {
                setNotice(`All pasted videos are already in "${target.name}".`);
                setLibraryLink('');
            } else {
                setNotice('Please paste valid YouTube video URLs.');
            }
            return;
        }
        commitLibraries(libraries.map((lib) => (lib.id === target.id ? { ...lib, videos: [...lib.videos, ...fresh] } : lib)));
        setLibraryLink('');
        setNotice(`Added ${fresh.length} video${fresh.length === 1 ? '' : 's'} to "${target.name}".${duplicates ? ` Skipped ${duplicates} duplicate${duplicates === 1 ? '' : 's'}.` : ''}`);
        // Replace each placeholder title with the real one (public oEmbed), like saved videos do.
        fresh.forEach(({ videoId }) => {
            fetch(`https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`)
                .then((response) => response.json())
                .then((data) => {
                    if (!data || typeof data.title !== 'string' || !data.title) return;
                    setLibraries((current) => {
                        const next = current.map((lib) => ({ ...lib, videos: lib.videos.map((entry) => (entry.videoId === videoId ? { ...entry, title: data.title } : entry)) }));
                        localStorage.setItem(LIBRARIES_KEY, JSON.stringify(next));
                        return next;
                    });
                })
                .catch(() => { });
        });
    }

    function exportLibraries() {
        const blob = new Blob([JSON.stringify(libraries, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'libraries.json';
        link.click();
        URL.revokeObjectURL(link.href);
        setNotice('libraries.json downloaded. Replace public/libraries.json with it and deploy so every user sees these libraries.');
    }

    function discardLibraryDraft() {
        if (!window.confirm('Discard your draft and reload the published libraries?')) return;
        localStorage.removeItem(LIBRARIES_KEY);
        loadLibraries();
        setNotice('Draft discarded.');
    }

    // Plays the first video now and puts the rest in the queue, so "Next in queue" continues the playlist.
    function playLibrary(lib) {
        if (!lib.videos.length) {
            setNotice('This library has no videos yet.');
            return;
        }
        const [first, ...rest] = lib.videos;
        setQueue(rest);
        playVideo(first.videoId);
        setNotice(`Playing "${lib.name}". The remaining videos are in your queue.`);
    }

    // Adds every video of a library to the end of the queue (skips ones already queued).
    function addLibraryToQueue(lib) {
        if (!lib.videos.length) {
            setNotice('This library has no videos yet.');
            return;
        }
        const have = new Set(queue.map((entry) => entry.videoId));
        const added = lib.videos.filter((video) => !have.has(video.videoId)).length;
        setQueue((current) => {
            const existing = new Set(current.map((entry) => entry.videoId));
            return [...current, ...lib.videos.filter((video) => !existing.has(video.videoId))];
        });
        setNotice(added ? `Added ${added} video${added === 1 ? '' : 's'} from "${lib.name}" to the queue.` : `All videos from "${lib.name}" are already in the queue.`);
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

        html { scroll-padding-top: 140px; }

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

        .yt-header { height: 64px; padding: 0 4%; display: flex; align-items: center; gap: 22px; position: fixed; top: 0; left: 0; right: 0; z-index: 50; background: #0f0f0f; border-bottom: 1px solid #272727; }

        .yt-brand { display: flex; align-items: center; gap: 8px; color: #f1f1f1; font-weight: 700; font-size: 20px; letter-spacing: -.6px; white-space: nowrap; }

        .yt-brand-icon { color: #ff0033; display: flex; align-items: center; }

        .yt-search { display: flex; width: min(660px, 60vw); margin: 0 auto; height: 40px; }

        .yt-search input { flex: 1; min-width: 0; border: 1px solid #303030; border-right: 0; border-radius: 22px 0 0 22px; background: #121212; padding: 0 18px; color: #f1f1f1; outline: none; }

        .yt-search input:focus { border-color: #1c62b9; }

        .yt-search button { width: 64px; display: grid; place-items: center; border: 1px solid #303030; border-radius: 0 22px 22px 0; background: #222; color: #f1f1f1; }

        .yt-layout { display: block; margin-top: 64px; min-height: calc(100vh - 64px); }

        .yt-sidebar { padding: 18px 12px; border-right: 1px solid #272727; }

        .yt-side-button { display: flex; width: 100%; align-items: center; gap: 22px; padding: 12px 16px; border: 0; border-radius: 10px; background: transparent; color: #f1f1f1; text-align: left; }

        .yt-side-button:hover, .yt-side-button.active { background: #272727; }

        .yt-side-note { margin: 22px 14px; color: #aaa; font-size: 12px; line-height: 1.5; }

        .yt-main { width: 100%; max-width: 1600px; padding: 24px clamp(16px, 3vw, 44px) 80px; margin: 0 auto; }

        .yt-pills { display: flex; gap: 10px; overflow-x: auto; padding: 12px 0; margin-bottom: 10px; scrollbar-width: none; -webkit-overflow-scrolling: touch; position: sticky; top: 64px; z-index: 40; background: #0f0f0f; border-bottom: 1px solid #272727; }

        .yt-pill { display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; white-space: nowrap; border: 0; border-radius: 8px; padding: 9px 13px; background: #272727; color: #f1f1f1; font-size: 14px; }

        .yt-pill-count { min-width: 20px; padding: 1px 6px; border-radius: 10px; background: #3f3f3f; color: #f1f1f1; font-size: 11px; font-weight: 700; line-height: 1.5; text-align: center; }

        .yt-pill.selected .yt-pill-count, .yt-pill:focus .yt-pill-count { background: #ffffff33; color: #fff; }

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
        .yt-loading-hint { max-width: 420px; color: #ffd24d; font-size: 13px; line-height: 1.5; }
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

        .yt-video-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 18px 12px; }

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
        .yt-cloud-form textarea { flex: 1; min-width: 160px; min-height: 84px; resize: vertical; border: 1px solid #3f3f3f; border-radius: 9px; padding: 10px 12px; background: #0f0f0f; color: #f1f1f1; font: inherit; }
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

        /* Compact saved-video cards: smaller thumbnails; the main player stays large. */
        .yt-video-grid .yt-thumb-wrap { border-radius: 8px; }
        .yt-video-grid .yt-mini-icon { display: none; }
        .yt-video-grid .yt-card-body { padding-top: 8px; }
        .yt-video-grid .yt-card-title { font-size: 13px; line-height: 1.3; margin: 0 0 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .yt-video-grid .yt-card-meta { font-size: 11px; margin: 0 0 6px; }
        .yt-video-grid .yt-actions { gap: 5px; }
        .yt-video-grid .yt-small-button { padding: 5px 8px; font-size: 11px; gap: 4px; }
        .yt-video-grid .yt-playing-badge { padding: 5px 8px; font-size: 10px; gap: 5px; }

        /* Icon-only buttons (hover shows the title tooltip) */
        .yt-small-button.icon { width: 34px; height: 34px; padding: 0; }
        .yt-video-grid .yt-small-button.icon { width: 30px; height: 30px; padding: 0; }
        .yt-small-button:disabled { opacity: .45; cursor: not-allowed; }

        /* Button click highlight */
        button { -webkit-tap-highlight-color: #ff003355; }
        .yt-small-button, .yt-pill, .yt-red-button, .yt-side-button, .yt-seg button { transition: background .12s ease, color .12s ease, transform .12s ease, box-shadow .12s ease; }
        .yt-small-button:active:not(:disabled), .yt-small-button.primary:active:not(:disabled), .yt-small-button.danger:active:not(:disabled) { background: #ff0033; color: #fff; transform: scale(.93); box-shadow: 0 0 0 3px #ff003355; }
        .yt-pill:active, .yt-pill.selected:active { background: #ff0033; color: #fff; transform: scale(.96); }
        .yt-red-button:active { background: #8f001e; transform: scale(.97); box-shadow: 0 0 0 3px #ff003355; }
        .yt-side-button:active { background: #ff003344; }
        .yt-seg button:active { background: #ff0033; color: #fff; }
        .yt-thumb-wrap:active .yt-thumb-overlay { background: #ff003366; }
        .yt-library-thumb:active { outline: 2px solid #ff0033; }
        .yt-small-button:focus-visible, .yt-pill:focus-visible, .yt-red-button:focus-visible, .yt-side-button:focus-visible { outline: 2px solid #3ea6ff; outline-offset: 2px; }
        /* Clicked button keeps the highlight colour (focus) until something else is clicked */
        .yt-small-button:focus:not(:disabled), .yt-small-button.primary:focus:not(:disabled), .yt-small-button.danger:focus:not(:disabled), .yt-seg button:focus { background: #ff0033; color: #fff; }
        .yt-red-button:focus { background: #b3001f; box-shadow: 0 0 0 3px #ff003355; }
        .yt-pill.selected, .yt-pill:focus { background: #ff0033; color: #fff; }
        .yt-side-button.active, .yt-side-button:focus { background: #ff0033; color: #fff; }
        .yt-side-button.active:hover, .yt-pill.selected:hover { background: #cc0029; }

        /* Library */
        .yt-library-panel { border: 1px solid #303030; border-radius: 14px; background: #161616; padding: 16px; margin: 24px 0 34px; }
        .yt-library-target { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: #aaa; font-size: 13px; margin: 4px 0 12px; }
        .yt-library-target select { border: 1px solid #3f3f3f; border-radius: 9px; padding: 8px 10px; background: #0f0f0f; color: #f1f1f1; }
        .yt-library-card { border-top: 1px solid #303030; padding: 12px 0; }
        .yt-library-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .yt-library-count { color: #aaa; font-size: 12px; font-weight: 400; margin-left: 8px; }
        .yt-library-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
        .yt-library-thumb { flex: 0 0 96px; width: 96px; aspect-ratio: 16 / 9; border: 0; padding: 0; border-radius: 6px; overflow: hidden; background: #272727; }
        .yt-library-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .yt-library-row .yt-queue-name { flex: 1; min-width: 0; }
        .yt-library-list { height: 420px; overflow-y: auto; overscroll-behavior: contain; padding-right: 4px; }
        .yt-lib-search { display: flex; align-items: center; gap: 8px; height: 38px; margin: 6px 0 12px; padding: 0 12px; border: 1px solid #3f3f3f; border-radius: 22px; background: #0f0f0f; color: #aaa; }
        .yt-lib-search:focus-within { border-color: #1c62b9; }
        .yt-lib-search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: #f1f1f1; }
        .yt-lib-clear { display: grid; place-items: center; border: 0; background: transparent; color: #aaa; padding: 4px; border-radius: 50%; }
        .yt-lib-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 10px; scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
        .yt-lib-tab { display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; white-space: nowrap; border: 0; border-radius: 8px; padding: 8px 13px; background: #272727; color: #f1f1f1; font-size: 13px; transition: background .12s ease, transform .12s ease; }
        .yt-lib-tab:hover { background: #3f3f3f; }
        .yt-lib-tab:active { transform: scale(.96); }
        .yt-lib-tab.selected { background: #ff0033; color: #fff; }
        .yt-lib-tab.selected .yt-pill-count { background: #ffffff33; color: #fff; }

        .yt-queue { margin: 24px 0 34px; padding: 16px; border: 1px solid #303030; border-radius: 14px; }

        .yt-queue-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #303030; padding: 11px 0; }

        .yt-queue-row:first-of-type { margin-top: 8px; }

        .yt-queue-name { font-size: 14px; overflow-wrap: anywhere; }

        .yt-empty { padding: 36px 16px; text-align: center; color: #aaa; border: 1px dashed #333; border-radius: 14px; }

        .yt-empty strong { display: block; color: #f1f1f1; margin: 12px 0 6px; }

        .yt-toast { position: fixed; z-index: 10; bottom: 20px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 24px); display: flex; align-items: center; gap: 16px; padding: 12px 16px; background: #272727; border: 1px solid #444; border-radius: 10px; box-shadow: 0 8px 30px #0008; font-size: 14px; }

        .yt-toast button { border: 0; background: transparent; color: #f1f1f1; display: flex; }

        .yt-menu-button { display: none; background: transparent; border: 0; color: #f1f1f1; }

        @media (max-width: 1050px) { .yt-video-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

        @media (max-width: 700px) { .yt-header { height: 58px; padding: 0 12px; gap: 12px; } .yt-brand { font-size: 17px; } .yt-brand-word { display: none; } .yt-search { width: auto; flex: 1; } .yt-search input { padding: 0 12px; } .yt-search button { width: 46px; } .yt-pills { top: 58px; } .yt-layout { margin-top: 58px; min-height: calc(100vh - 58px); } .yt-pill { padding: 8px 11px; font-size: 13px; gap: 5px; } .yt-main { padding: 16px 12px 60px; } .yt-library-list { height: 360px; } .yt-video-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 10px; } .yt-add-form { flex-direction: column; } .yt-add-form .yt-red-button { width: 100%; } .yt-player { border-radius: 9px; } .yt-add-panel { padding: 14px; } .yt-section-title { font-size: 18px; } }

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

        <div className="yt-brand"><span className="yt-brand-icon"><Youtube size={30} fill="currentColor"/></span><span className="yt-brand-word">Sonora</span></div>

        <form className="yt-search" onSubmit={(event) => { event.preventDefault(); openSearch(); }}>

          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search saved videos or search YouTube" aria-label="Search videos"/>

          <button type="submit" aria-label="Search YouTube"><Search size={20}/></button>

        </form>

      </header>



      <div className="yt-layout">





        <main className="yt-main">

          <div className="yt-pills">

            <button className={`yt-pill ${navPill === 'all' ? 'selected' : ''}`} onClick={() => { setNavPill('all'); setSearch(''); setShowFavoritesOnly(false); setShowHistory(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Play size={14} fill="currentColor"/> All</button>

            <button className={`yt-pill ${navPill === 'add-link' ? 'selected' : ''}`} onClick={() => { setNavPill('add-link'); document.getElementById('add-link')?.scrollIntoView({ behavior: 'smooth' }); }}><Link2 size={14}/> Add link</button>

            <button className={`yt-pill ${navPill === 'saved' ? 'selected' : ''}`} onClick={() => { setNavPill('saved'); document.getElementById('saved-videos')?.scrollIntoView({ behavior: 'smooth' }); }}><ListVideo size={14}/> Saved videos <span className="yt-pill-count">{items.length}</span></button>

            <button className={`yt-pill ${navPill === 'favorites' ? 'selected' : ''}`} onClick={() => { setNavPill(showFavoritesOnly ? 'all' : 'favorites'); setShowFavoritesOnly((value) => !value); setShowHistory(false); }}><Heart size={14}/> {showFavoritesOnly ? 'All videos' : 'Favorites'} <span className="yt-pill-count">{favorites.length}</span></button>

            <button className={`yt-pill ${navPill === 'history' ? 'selected' : ''}`} onClick={() => { setNavPill(showHistory ? 'all' : 'history'); setShowHistory((value) => !value); }}><History size={14}/> Watch history <span className="yt-pill-count">{history.length}</span></button>

            <button className={`yt-pill ${navPill === 'library' ? 'selected' : ''}`} onClick={() => { setNavPill('library'); document.getElementById('libraries')?.scrollIntoView({ behavior: 'smooth' }); }}><Library size={14}/> Library <span className="yt-pill-count">{libraries.length}</span></button>

            <button className={`yt-pill ${navPill === 'queue' ? 'selected' : ''}`} onClick={() => { setNavPill('queue'); document.getElementById('queue')?.scrollIntoView({ behavior: 'smooth' }); }}><Clock3 size={14}/> Queue <span className="yt-pill-count">{queue.length}</span></button>

{/* <button className={`yt-pill ${navPill === 'cloud' ? 'selected' : ''}`} onClick={() => { setNavPill('cloud'); document.getElementById('cloud-sync')?.scrollIntoView({ behavior: 'smooth' }); }}><Cloud size={14}/> Cloud sync</button> */}

          </div>



          <section className="yt-add-panel" id="add-link">

            <h1 className="yt-section-title"><span>Add a YouTube link</span><Link2 size={21}/></h1>

            <form className="yt-add-form" onSubmit={addLink}>

              <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a YouTube video URL here…" aria-label="YouTube video URL" required/>

              <button className="yt-red-button" type="submit" title="Save this link to your saved videos and start playing it"><Plus size={18}/> Save link</button>

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
                        {slowLoad && <span className="yt-loading-hint">Taking longer than usual. Please click on "Reload player". If it still hasn't loaded in 1 minute, the player will reload automatically.</span>}
                      </div>
                    )}

                </div>

              </div>) : (<div className="yt-player-empty"><div><Youtube size={42}/><strong>Your player is ready</strong><span>Add a link or choose a saved video below.</span></div></div>)}



            <div className="yt-toolbar">

              <div className="yt-seg" role="group" aria-label="Player mode">

                <button className={mode === 'adfree' ? 'on' : ''} onClick={() => setMode('adfree')} title="Ad-free site: plays the video through the ad-free player"><ShieldCheck size={13} style={{ verticalAlign: 'middle' }}/> Ad-free site</button>

                {/* <button className={mode === 'official' ? 'on' : ''} onClick={() => setMode('official')}>YouTube embed</button> */}

              </div>

              <button className="yt-small-button icon" onClick={playNextQueued} title="Next in queue: play the next video from your queue" aria-label="Next in queue"><SkipForward size={16}/></button>

              {activeId && <button className="yt-small-button icon" onClick={() => setReloadKey((key) => key + 1)} title="Reload player: use this if the video is stuck loading or blank" aria-label="Reload player"><RefreshCw size={16}/></button>}

              {activeId && <button className="yt-small-button icon" title="Full screen: fill the whole screen with the player" aria-label="Full screen" onClick={async () => { const player = document.querySelector('.yt-player'); if (!player) return; try { if (document.fullscreenElement) { await document.exitFullscreen(); } else if (player.requestFullscreen) { await player.requestFullscreen(); } } catch (error) { console.error('Fullscreen could not be opened:', error); } }}><Fullscreen size={16}/></button>}

              {activeItem && <button className="yt-small-button icon" onClick={() => setMiniPlayer((value) => !value)} title={miniPlayer ? 'Expand player: return to the full-size player' : 'Mini player: keep the video floating in the corner while you browse'} aria-label={miniPlayer ? 'Expand player' : 'Mini player'}>{miniPlayer ? <Maximize2 size={16}/> : <PictureInPicture2 size={16}/>}</button>}
              {/* {activeItem && <button className="yt-small-button" onClick={copyActiveLink}><Copy size={14}/> Copy link</button>} */}

            </div>



            {/* {activeItem && <p className="yt-subtle">If the player stays blank, the site may block embedding: switch the player mode, reload, or <a href={activeItem.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3ea6ff' }}>open appended link <ArrowUpRight size={13} style={{ verticalAlign: 'middle' }}/></a>. Note: auto-play of the next queued video is not possible with an embedded third-party site, so use "Next in queue".</p>} */}

          </section>



{/* 
          <section className="yt-cloud-panel" id="cloud-sync">
            <h2 className="yt-section-title"><span><Cloud size={20} style={{ verticalAlign: 'middle', marginRight: 8 }}/>Cloud sync</span><span style={{ color: '#aaa', fontSize: 12 }}>{session?.user?.email || 'Not signed in'}</span></h2>
            {!supabase ? (
              <p className="yt-cloud-status">Cloud sync needs a Supabase project. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then restart Vite. Your library still works locally without this setup.</p>
            ) : session ? (
              <>
                <p className="yt-cloud-status">Sync saved videos, favorites, watch history and queue across devices using the same account.</p>
                <div className="yt-cloud-form"><button className="yt-red-button" onClick={syncCloud} disabled={cloudBusy} title="Sync now: merge this device's library with your cloud account"><Cloud size={15}/>{cloudBusy ? 'Syncing…' : 'Sync now'}</button><button className="yt-small-button icon" onClick={signOutCloud} title="Sign out of cloud sync" aria-label="Sign out"><LogOut size={14}/></button></div>
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
          </section> */}

          {showHistory && <section className="yt-queue">
            <h2 className="yt-section-title"><span><History size={20} style={{ verticalAlign: 'middle', marginRight: 8 }}/>Recently played</span><button className="yt-small-button danger icon" onClick={() => { setHistory([]); setNotice('Watch history cleared.'); }} title="Clear history: remove all recently played videos" aria-label="Clear history"><Trash2 size={14}/></button></h2>
            {history.length ? <div className="yt-history-list">{history.slice(0, 20).map((item) => <div className="yt-history-row" key={item.videoId}><span className="yt-queue-name">{item.title}</span><button className="yt-small-button primary icon" onClick={() => playVideo(item.videoId)} title="Play this video again" aria-label="Play"><Play size={14}/></button></div>)}</div> : <p className="yt-cloud-status">Videos you play will appear here.</p>}
          </section>}

          {queue.length > 0 && <section className="yt-queue" id="queue">

            <h2 className="yt-section-title"><span>Up next <span style={{ color: '#aaa', fontSize: 14 }}>{queue.length} videos</span></span><span style={{ display: 'flex', gap: 8 }}><button className="yt-small-button icon" onClick={shuffleQueue} title="Shuffle: play the queue in random order" aria-label="Shuffle"><Shuffle size={14}/></button><button className="yt-small-button danger icon" onClick={() => setQueue([])} title="Clear queue: remove all videos from the queue" aria-label="Clear queue"><Trash2 size={14}/></button></span></h2>

            {queue.map((item, index) => <div className="yt-queue-row" key={`${item.videoId}-${index}`}><span className="yt-queue-name">{index + 1}. {item.title}</span><div style={{ display: 'flex', gap: 6 }}><button className="yt-small-button" disabled={index === 0} onClick={() => moveQueueItem(index, -1)} aria-label="Move up" title="Move up in the queue"><ChevronUp size={14}/></button><button className="yt-small-button" disabled={index === queue.length - 1} onClick={() => moveQueueItem(index, 1)} aria-label="Move down" title="Move down in the queue"><ChevronDown size={14}/></button><button className="yt-small-button primary" onClick={() => { playVideo(item.videoId); setQueue((current) => current.filter((entry, i) => !(entry.videoId === item.videoId && i === index))); }} title="Play this video now" aria-label="Play now"><Play size={14}/></button><button className="yt-small-button" title="Remove from queue" aria-label="Remove from queue" onClick={() => setQueue((current) => current.filter((_, i) => i !== index))}><X size={15}/></button></div></div>)}

          </section>}



          <section className="yt-library-panel" id="libraries">
            <h2 className="yt-section-title"><span><Library size={20} style={{ verticalAlign: 'middle', marginRight: 8 }}/>Library</span><span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 12 }}>{libraries.length} {libraries.length === 1 ? 'playlist' : 'playlists'}
              {isAdmin
                ? <button className="yt-small-button icon" onClick={lockAdmin} title="Admin mode is on: click to lock it" aria-label="Lock admin mode"><Unlock size={14}/></button>
                : <button className="yt-small-button icon" onClick={() => setShowAdminLogin((value) => !value)} title="Admin login: create and edit libraries" aria-label="Admin login"><Lock size={14}/></button>}
            </span></h2>
            {!isAdmin && showAdminLogin && <form className="yt-cloud-form" onSubmit={unlockAdmin}>
              <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Admin password" required aria-label="Admin password"/>
              <button className="yt-red-button" type="submit" title="Unlock the admin controls"><LogIn size={14}/> Unlock</button>
            </form>}
            {isAdmin && <form className="yt-cloud-form" onSubmit={createLibrary}>
              <input type="text" value={newLibraryName} onChange={(event) => setNewLibraryName(event.target.value)} placeholder="New library name (e.g. Mostly Viewed)" maxLength={60} required aria-label="New library name"/>
              <button className="yt-red-button" type="submit" title="Create a new library"><Plus size={16}/> Create library</button>
            </form>}
            {isAdmin && <div className="yt-library-target">
              {libraries.length > 0 && <><span>Add videos to:</span>
                <select value={activeTargetId} onChange={(event) => setTargetLibraryId(event.target.value)} aria-label="Target library">{libraries.map((lib) => <option key={lib.id} value={lib.id}>{lib.name}</option>)}</select>
                <span>(use the folder icon on a saved video below)</span></>}
              <button className="yt-small-button icon" onClick={exportLibraries} title="Export libraries.json: put it in the public folder and deploy so all users see these libraries" aria-label="Export libraries"><Download size={16}/></button>
              <button className="yt-small-button icon" onClick={discardLibraryDraft} title="Discard draft: go back to the published libraries" aria-label="Discard draft"><RotateCcw size={16}/></button>
            </div>}
            {isAdmin && libraries.length > 0 && <form className="yt-cloud-form" onSubmit={addLinkToLibrary} style={{ alignItems: 'flex-end' }}>
              <textarea value={libraryLink} onChange={(event) => setLibraryLink(event.target.value)} placeholder={`Paste one or more YouTube links (one per line) to add to "${libraries.find((lib) => lib.id === activeTargetId)?.name || ''}"`} required rows={4} aria-label="YouTube links to add to the selected library"/>
              <button className="yt-red-button" type="submit" title="Add all pasted links to the selected library"><Plus size={16}/> Add to library</button>
            </form>}
            {libraries.length ? <>
              <div className="yt-lib-search">
                <Search size={16}/>
                <input type="search" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder={`Search in "${shownLib?.name || ''}"`} aria-label="Search videos in this library"/>
                {librarySearch && <button className="yt-lib-clear" onClick={() => setLibrarySearch('')} aria-label="Clear library search" title="Clear search"><X size={14}/></button>}
              </div>
              <div className="yt-lib-tabs" role="tablist" aria-label="Libraries">
                {libraries.map((lib) => <button key={lib.id} role="tab" aria-selected={lib.id === activeTargetId} className={`yt-lib-tab ${lib.id === activeTargetId ? 'selected' : ''}`} onClick={() => { setTargetLibraryId(lib.id); setLibrarySearch(''); }}>{lib.name} <span className="yt-pill-count">{lib.videos.length}</span></button>)}
              </div>
              {shownLib && <div className="yt-library-card">
                <div className="yt-library-head">
                  <strong>{shownLib.name}<span className="yt-library-count">{libTerm ? `${shownVideos.length} of ${shownLib.videos.length}` : shownLib.videos.length} {shownLib.videos.length === 1 ? 'video' : 'videos'}</span></strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="yt-small-button icon" onClick={() => addLibraryToQueue({ ...shownLib, videos: shownVideos })} disabled={!shownVideos.length} title="Queue all: add the listed videos of this library to the queue" aria-label="Queue all"><ListPlus size={14}/></button>
                    <button className="yt-small-button primary icon" onClick={() => playLibrary({ ...shownLib, videos: shownVideos })} disabled={!shownVideos.length} title="Play all: start this playlist; the rest go to your queue" aria-label="Play all"><Play size={14} fill="currentColor"/></button>
                    {isAdmin && <button className="yt-small-button danger icon" onClick={() => deleteLibrary(shownLib.id)} title="Admin: delete this library" aria-label="Delete library"><Trash2 size={14}/></button>}
                  </div>
                </div>
                <div className="yt-library-list">
                  {shownVideos.length ? shownVideos.map((video) => <div className="yt-library-row" key={video.videoId}>
                    <button className="yt-library-thumb" onClick={() => playVideo(video.videoId)} title="Play this video" aria-label={`Play ${video.title}`}><img src={`https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`} alt="" loading="lazy"/></button>
                    <span className="yt-queue-name">{video.title}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="yt-small-button primary icon" onClick={() => playVideo(video.videoId)} title="Play this video" aria-label="Play"><Play size={14}/></button>
                      {isAdmin && <button className="yt-small-button icon" onClick={() => removeFromLibrary(shownLib.id, video.videoId)} title="Admin: remove from this library" aria-label="Remove from library"><X size={14}/></button>}
                    </div>
                  </div>) : <p className="yt-cloud-status">{libTerm ? 'No videos match your search.' : (isAdmin ? 'No videos yet. Paste YouTube links above to add them.' : 'No videos in this library yet.')}</p>}
                </div>
              </div>}
            </> : <p className="yt-cloud-status">{isAdmin ? 'No libraries yet. Create one above.' : 'No libraries have been published yet.'}</p>}
            {isAdmin && <p className="yt-cloud-status">Draft mode: changes are saved only in this browser. Use the export icon, replace public/libraries.json, and deploy to publish them to everyone.</p>}
          </section>

          <section id="saved-videos">

            <div className="yt-list-heading">

              <h2 className="yt-section-title" style={{ margin: 0 }}>Saved videos</h2>

              <div className="yt-list-tools">

                <span style={{ color: '#aaa', fontSize: 13 }}>{filteredItems.length} videos</span>

                <button className="yt-small-button icon" onClick={addAllToQueue} disabled={!filteredItems.length} title="Queue all: add every listed video to the queue" aria-label="Queue all"><ListPlus size={16}/></button>

                <button className="yt-small-button icon" onClick={exportBackup} disabled={!items.length} title="Backup: download your saved videos as a JSON file" aria-label="Backup"><Download size={16}/></button>

                <button className="yt-small-button icon" onClick={() => importRef.current?.click()} title="Import: load saved videos from a backup JSON file" aria-label="Import"><Upload size={16}/></button>

                <input ref={importRef} type="file" accept="application/json,.json" onChange={importBackup} style={{ display: 'none' }}/>

              </div>

            </div>

            {filteredItems.length ? <div className="yt-video-grid">{filteredItems.map((item) => <article className="yt-video-card" key={item.id}>

              <button className="yt-thumb-wrap" onClick={() => playVideo(item.videoId)} aria-label={activeId === item.videoId ? `Now playing ${item.title}` : `Play ${item.title}`}>

                <img className="yt-thumb" src={`https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`} alt="" loading="lazy"/>

                <span className="yt-thumb-overlay">{activeId === item.videoId ? <span className="yt-playing-badge"><Play size={12} fill="currentColor"/> PLAYING</span> : <Play size={28} fill="white" color="white"/>}</span>

              </button>

              <div className="yt-card-body"><div className="yt-mini-icon"><Youtube size={18} fill="currentColor"/></div><div className="yt-card-info">

                <h3 className="yt-card-title">{item.title}</h3><p className="yt-card-meta">Saved to Sonora · {new Date(item.addedAt).toLocaleDateString()}</p>

                <div className="yt-actions">

                  <button className="yt-small-button icon" onClick={() => toggleFavorite(item.videoId)} title={favorites.includes(item.videoId) ? 'Remove from favorites' : 'Add to favorites'} aria-label={favorites.includes(item.videoId) ? 'Remove from favorites' : 'Add to favorites'} style={{ color: favorites.includes(item.videoId) ? '#ff4d6d' : undefined }}><Heart size={14} fill={favorites.includes(item.videoId) ? 'currentColor' : 'none'}/></button>
                  <button className="yt-small-button icon" onClick={() => addToQueue(item)} title="Add to queue" aria-label="Add to queue"><ListPlus size={14}/></button>
                  {isAdmin && <button className="yt-small-button icon" onClick={() => addToLibrary(item)} title="Admin: add to the selected library" aria-label="Add to library"><FolderPlus size={14}/></button>}

                  {/* <a className="yt-small-button" href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}><ExternalLink size={14}/> Appended link</a> */}

                  <button className="yt-small-button danger icon" title="Remove from saved videos" aria-label="Delete saved video" onClick={() => { setItems((current) => current.filter((entry) => entry.videoId !== item.videoId)); setQueue((current) => current.filter((entry) => entry.videoId !== item.videoId)); if (activeId === item.videoId)

                setActiveId(''); setNotice('Removed saved video.'); }}><Trash2 size={14}/></button>

                </div>

              </div></div>

            </article>)}</div> : <div className="yt-empty"><Youtube size={36}/><strong>No saved videos yet</strong><span>Paste a YouTube link above to save it here.</span></div>}

          </section>

        </main>

      </div>



      {notice && <div className="yt-toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={16}/></button></div>}

    </div>);

}
