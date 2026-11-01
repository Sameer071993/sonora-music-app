import { useEffect, useMemo, useRef, useState } from 'react';
// import { createClient } from '@supabase/supabase-js';

import { Youtube, Compass, Headphones, Info, Search, Plus, Play, ExternalLink, Trash2, ListVideo, X, Link2, ArrowUpRight, Clock3, Menu, SkipForward, RefreshCw, Copy, Download, Upload, ShieldCheck, Heart, History, Minimize2, Maximize2, Shuffle, Cloud, LogIn, LogOut, ChevronUp, ChevronDown, Library, FolderPlus, ListPlus, PictureInPicture2, Fullscreen, Lock, Unlock, RotateCcw } from 'lucide-react';

const STORAGE_KEY = 'sonora-youtube-links';

const ACTIVE_KEY = 'sonora-active-youtube';

const QUEUE_KEY = 'sonora-youtube-queue';

const MODE_KEY = 'sonora-player-mode';

const BG_KEY = 'sonora-background-play';

const TOUR_KEY = 'sonora-tour-seen';

const POS_KEY = 'sonora-last-position';

const NOTICE_SECONDS = 5; // information toasts close by themselves after this many seconds 4c3490

// Logo image from the public folder. Put the exact file name first; the next ones are tried automatically if a file is missing.
// const LOGO_FILES = ['logo.png', 'icon-192.png', 'pwa-192x192.png', 'icons/icon-192.png', 'apple-touch-icon.png', 'favicon.png'];
const LOGO_FILES = ['sonora-192.png', 'sonora-192.webp', 'sonora-192.jpg', 'sonora-192.svg'];

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

// A one-second silent WAV, generated in memory. Looping it keeps the page registered as a media player
// (so Android keeps it alive in the background and shows a notification) without any sound being heard.
function createSilentWavUrl() {
    const sampleRate = 8000;
    const samples = sampleRate;
    const buffer = new ArrayBuffer(44 + samples);
    const view = new DataView(buffer);
    const write = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
    write(0, 'RIFF');
    view.setUint32(4, 36 + samples, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    write(36, 'data');
    view.setUint32(40, samples, true);
    new Uint8Array(buffer, 44).fill(128);
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

// Guided tour: each step highlights one part of the page (CSS selector in `target`) and explains it.
const TOUR_STEPS = [
    { target: '.yt-brand', top: true, title: 'Welcome to Sonora', text: 'Sonora saves your YouTube links, builds a queue and plays everything in an ad-free player. This short tour highlights every feature. Tap Next to continue, or Skip tour at any time. You can reopen it later from the Guide button.' },
    { target: '.yt-search', top: true, title: 'Search', text: 'Type here to filter your saved videos by title. Press the search button to search YouTube in a new browser tab.' },
    { target: '.yt-pills', top: true, title: 'Top bar', text: 'Quick buttons that jump to each part of the app. The bar stays on screen while you scroll, and the numbers show how many items each section holds.', points: ['All: clears filters and goes back to the top', 'Add link: jump to the box for saving a link', 'Saved videos: your saved list', 'Favorites: show only the videos you hearted (tap again for All videos)', 'Watch history: the videos you played recently', 'Library: ready-made playlists', 'Queue: videos waiting to play'] },
    { target: '#add-link', title: 'Add a YouTube link', text: 'Paste any YouTube video link (watch, Shorts, live or youtu.be) and tap Save link. It is saved on this device and starts playing right away. Links shared to Sonora from other apps also land in this box.' },
    { target: '.yt-player-section', title: 'The player', text: 'Your video plays here. A loading screen shows while it starts. If it is slow, a hint appears after 10 seconds and the player reloads by itself after 1 minute.' },
    { target: '.yt-toolbar', title: 'Player controls', text: 'Buttons under the player:', points: ['Ad-free site: the player mode in use', 'Skip icon: play the next video from your queue', 'Reload icon: use it if the video is stuck or blank', 'Full screen icon: fill the whole screen with the player', 'Mini player icon: float the video in a corner while you browse (use its corner buttons to expand or close)', 'Headphones: background play', 'i icon: tips for background play'] },
    { target: '.yt-toolbar', title: 'Background play', text: 'Turn on the headphones button (it turns purple) to keep music going when you leave the app or turn off the screen. On Android the song should appear in the notification bar, and its Next button plays the next queued video. For the best result use the full-size or full-screen player, and install Sonora to your home screen. iPhone and iPad usually pause web apps when you leave them. If the video pauses when the screen turns off, tap Reload player to continue from about the same spot.' },
    { target: '#queue', title: 'Queue', text: 'Videos you add with the list-plus button, or with Play all from a library, wait here. Use the arrows to reorder, the shuffle icon to mix them, the play button to play one now, or clear everything. The next video does not start by itself: press the skip icon under the player.' },
    { target: '#libraries', title: 'Library', text: 'Playlists published with the app. Each playlist is a tab with its video count (swipe sideways to see all tabs).', points: ['Search box: finds videos inside the open playlist', 'List-plus button (Queue all): adds the listed videos to your queue', 'Play button (Play all): plays the first video and queues the rest', 'Lock icon: admin login for the site owner to create playlists, paste many links at once and export libraries.json'] },
    { target: '#saved-videos', title: 'Saved videos', text: 'Everything you saved. Tap a thumbnail to play it.', points: ['Heart: add or remove a favorite', 'List-plus: add to the queue', 'Trash: remove from your saved list', 'Header icons: Queue all, Backup (download a JSON file) and Import (load a backup)'] },
    { title: 'Keep your data safe', text: 'Saved videos, favorites, history and the queue are stored in this browser on this device only. Use Backup in Saved videos now and then, and Import to restore it on another device. To install Sonora, open your browser menu and choose Add to Home screen or Install app.' },
    { title: 'You are all set', text: 'Enjoy Sonora. Tap the Guide button next to the logo whenever you want to see this tour again.' },
];

// Last saved (estimated) playback position of a video, in seconds. 0 when unknown or too small to matter.
function readSavedPosition(videoId) {
    try {
        const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
        return saved && saved.videoId === videoId && Number(saved.seconds) >= 5 ? Math.floor(Number(saved.seconds)) : 0;
    } catch {
        return 0;
    }
}

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

function getPlayerSrc(mode, videoId, startAt = 0) {

    if (mode === 'official') {

        return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&playsinline=1${startAt ? `&start=${startAt}` : ''}`;

    }

    return `https://www.yout-ube.com/watch?v=${videoId}&autoplay=1${startAt ? `&t=${startAt}s` : ''}`;

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

    const [activeId, setActiveId] = useState('');

    // Last played video: shown as a tap-to-resume poster instead of loading the heavy player at app start.
    const [resumeId, setResumeId] = useState(() => localStorage.getItem(ACTIVE_KEY) || '');

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
    const [startAt, setStartAt] = useState(0); // seconds the player should start from (used by Reload player)
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

    const [notice, setNoticeText] = useState('');
    const [noticeStamp, setNoticeStamp] = useState(0);
    const [noticeLeft, setNoticeLeft] = useState(NOTICE_SECONDS);
    const [showStartupLoader, setShowStartupLoader] = useState(true);

    const [navPill, setNavPill] = useState('all'); // last clicked top pill (stays highlighted)
    const [librarySearch, setLibrarySearch] = useState('');
    const [bgPlay, setBgPlay] = useState(() => localStorage.getItem(BG_KEY) === '1');
    const [showBgHelp, setShowBgHelp] = useState(false);
    const [tourStep, setTourStep] = useState(null);
    const [tourRect, setTourRect] = useState(null);
    const [tourSeen, setTourSeen] = useState(() => localStorage.getItem(TOUR_KEY) === '1');
    const [logoIndex, setLogoIndex] = useState(0);

    const triedTitles = useRef(new Set());

    const importRef = useRef(null);

    const bgAudioRef = useRef(null);

    const playNextRef = useRef(null);

    const reloadRef = useRef(null);

    // Rough playback clock: when the current player loaded, where it started, and where it probably paused when the screen went off.
    const playClockRef = useRef({ startedAt: 0, base: 0, frozenPos: null, hiddenAt: null });

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

        if (activeId) {

            localStorage.setItem(ACTIVE_KEY, activeId);

            setResumeId(activeId);

        }

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

    const resumeItem = !activeId && resumeId ? (items.find((item) => item.videoId === resumeId) || queue.find((item) => item.videoId === resumeId) || libraries.flatMap((lib) => lib.videos || []).find((item) => item.videoId === resumeId)) : null;

    const resumeSeconds = resumeItem ? readSavedPosition(resumeItem.videoId) : 0;

    const filteredItems = useMemo(() => {

        const term = search.trim().toLowerCase();

        const base = showFavoritesOnly ? items.filter((item) => favorites.includes(item.videoId)) : items;
        if (!term) return base;
        return base.filter((item) => item.title.toLowerCase().includes(term) || item.videoId.toLowerCase().includes(term));
    }, [items, search, showFavoritesOnly, favorites]);

    // ---- Information toast: closes by itself after 5 seconds, with a countdown; the cross closes it sooner ----
    function setNotice(message) {
        setNoticeText(message);
        setNoticeStamp((value) => value + 1);
    }

    useEffect(() => {
        if (!notice) return undefined;
        setNoticeLeft(NOTICE_SECONDS);
        const interval = window.setInterval(() => setNoticeLeft((value) => Math.max(value - 1, 0)), 1000);
        const timer = window.setTimeout(() => setNoticeText(''), NOTICE_SECONDS * 1000);
        return () => {
            window.clearInterval(interval);
            window.clearTimeout(timer);
        };
    }, [notice, noticeStamp]);

    // ---- Resume position (best effort) ----
    function formatClock(totalSeconds) {
        return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
    }

    // Reload player. If the page was away (for example the screen was turned off) the player probably paused a few seconds later,
    // so restart from about that spot. The position is an estimate and only works if the player site accepts a start time.
    function reloadPlayer() {
        const clock = playClockRef.current;
        if (clock.frozenPos != null && clock.frozenPos >= 5) {
            const seconds = Math.floor(clock.frozenPos);
            setStartAt(seconds);
            setNotice(`Reloading from about ${formatClock(seconds)}. The spot is an estimate, so you may need to nudge it.`);
        }
        setReloadKey((key) => key + 1);
    }

    // Plays the last video again, starting from the position saved for it (estimated, see savePosition below).
    function resumeLast() {
        if (!resumeItem) return;
        const seconds = readSavedPosition(resumeItem.videoId);
        playVideo(resumeItem.videoId);
        if (seconds) {
            setStartAt(seconds);
            setNotice(`Resuming from about ${formatClock(seconds)}. If it starts from the beginning, the player site does not accept a start time.`);
        }
    }

    // Saves an estimated playback position every few seconds (and when the page closes or reloads).
    // Sonora cannot read the real time from the player, so this assumes the video kept playing since it loaded.
    useEffect(() => {
        if (!activeId) return undefined;
        const savePosition = () => {
            const clock = playClockRef.current;
            if (!clock.startedAt) return;
            const pos = clock.frozenPos != null ? clock.frozenPos : clock.base + (Date.now() - clock.startedAt) / 1000;
            try {
                localStorage.setItem(POS_KEY, JSON.stringify({ videoId: activeId, seconds: Math.floor(pos), savedAt: Date.now() }));
            } catch { /* storage full or blocked */ }
        };
        const timer = window.setInterval(savePosition, 5000);
        window.addEventListener('pagehide', savePosition);
        window.addEventListener('beforeunload', savePosition);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener('pagehide', savePosition);
            window.removeEventListener('beforeunload', savePosition);
        };
    }, [activeId]);

    useEffect(() => {
        const onVisibility = () => {
            const clock = playClockRef.current;
            if (document.visibilityState === 'hidden') {
                clock.hiddenAt = Date.now();
            } else if (clock.hiddenAt && clock.startedAt) {
                // The player usually pauses a few seconds after the screen turns off, so remember about where that was.
                if (Date.now() - clock.hiddenAt > 10000 && clock.frozenPos == null) {
                    clock.frozenPos = clock.base + (clock.hiddenAt + 5000 - clock.startedAt) / 1000;
                }
                clock.hiddenAt = null;
            }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    // ---- Guided tour ----
    function startTour() {
        setShowBgHelp(false);
        setTourRect(null);
        setTourStep(0);
    }

    function closeTour() {
        setTourStep(null);
        setTourRect(null);
        setTourSeen(true);
        localStorage.setItem(TOUR_KEY, '1');
    }

    function tourNext() {
        if (tourStep === null) return;
        if (tourStep >= TOUR_STEPS.length - 1) closeTour();
        else setTourStep(tourStep + 1);
    }

    function tourBack() {
        if (tourStep !== null && tourStep > 0) setTourStep(tourStep - 1);
    }

    // Scrolls to the highlighted part of the page and keeps the spotlight on it while scrolling/resizing.
    useEffect(() => {
        if (tourStep === null) return undefined;
        const step = TOUR_STEPS[tourStep];
        if (!step.target) {
            setTourRect(null);
            return undefined;
        }
        const measure = () => {
            const el = document.querySelector(step.target);
            if (!el) {
                setTourRect({ missing: true });
                return;
            }
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) {
                setTourRect({ missing: true });
                return;
            }
            const top = Math.max(r.top - 6, 4);
            const bottom = Math.min(r.bottom + 6, window.innerHeight - 4);
            if (bottom <= top + 8) return;
            const left = Math.max(r.left - 6, 4);
            const right = Math.min(r.right + 6, window.innerWidth - 4);
            setTourRect({ top, left, width: right - left, height: bottom - top });
        };
        const target = document.querySelector(step.target);
        if (step.top) window.scrollTo({ top: 0, behavior: 'smooth' });
        else if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        measure();
        const timers = [window.setTimeout(measure, 350), window.setTimeout(measure, 900)];
        let frame = 0;
        const onMove = () => {
            window.cancelAnimationFrame(frame);
            frame = window.requestAnimationFrame(measure);
        };
        window.addEventListener('scroll', onMove, true);
        window.addEventListener('resize', onMove);
        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
            window.cancelAnimationFrame(frame);
            window.removeEventListener('scroll', onMove, true);
            window.removeEventListener('resize', onMove);
        };
    }, [tourStep]);

    useEffect(() => {
        if (tourStep === null) return undefined;
        const onKey = (event) => {
            if (event.key === 'ArrowRight') tourNext();
            else if (event.key === 'ArrowLeft') tourBack();
            else if (event.key === 'Escape') closeTour();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [tourStep]);

    // ---- Background play (Android notification + screen-off) ----
    const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

    function ensureBgAudio() {
        if (!bgAudioRef.current) {
            const audio = new Audio(createSilentWavUrl());
            audio.loop = true;
            bgAudioRef.current = audio;
        }
        return bgAudioRef.current;
    }

    function toggleBackgroundPlay() {
        const next = !bgPlay;
        setBgPlay(next);
        if (next) {
            // Started inside the tap so the browser allows it.
            ensureBgAudio().play().catch(() => { });
            setNotice(isIOS
                ? 'Background play is on, but iPhone/iPad usually pause web apps when you leave them. Tap the info button for tips.'
                : 'Background play is on. Music can continue while you use other apps. Android or the player site may still pause it when the screen turns off - tap the info button for tips.');
        } else {
            setNotice('Background play is off.');
        }
    }

    async function openPlayerFullscreen() {
        const player = document.querySelector('.yt-player');
        if (!player) {
            setNotice('Play a video first, then open it in full screen.');
            return;
        }
        try {
            if (player.requestFullscreen) await player.requestFullscreen();
        } catch (error) {
            console.error('Fullscreen could not be opened:', error);
        }
    }

    useEffect(() => {
        localStorage.setItem(BG_KEY, bgPlay ? '1' : '0');
    }, [bgPlay]);

    // Keeps a silent audio loop running while a video is playing and publishes the song to the system media controls.
    useEffect(() => {
        const mediaSession = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
        if (!bgPlay || !activeId) {
            if (bgAudioRef.current) bgAudioRef.current.pause();
            if (mediaSession) {
                try {
                    mediaSession.metadata = null;
                    mediaSession.playbackState = 'none';
                } catch { /* not supported */ }
            }
            return;
        }
        ensureBgAudio().play().catch(() => { /* needs a tap first; retried on the next tap */ });
        if (mediaSession && typeof MediaMetadata !== 'undefined') {
            try {
                mediaSession.metadata = new MediaMetadata({
                    title: activeItem ? activeItem.title : 'Sonora',
                    artist: 'Sonora',
                    album: 'Sonora',
                    artwork: [{ src: `https://i.ytimg.com/vi/${activeId}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' }],
                });
                mediaSession.playbackState = 'playing';
                mediaSession.setActionHandler('nexttrack', () => { if (playNextRef.current) playNextRef.current(); });
                // Best effort only: these commands work if the player site listens for them; otherwise they are ignored.
                const sendPlayerCommand = (func) => {
                    const frame = document.querySelector('.yt-player iframe');
                    if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: '' }), '*');
                };
                mediaSession.setActionHandler('play', () => {
                    if (playClockRef.current.frozenPos != null && reloadRef.current) reloadRef.current();
                    else sendPlayerCommand('playVideo');
                    ensureBgAudio().play().catch(() => { });
                    mediaSession.playbackState = 'playing';
                });
                mediaSession.setActionHandler('pause', () => {
                    sendPlayerCommand('pauseVideo');
                    mediaSession.playbackState = 'paused';
                });
            } catch { /* not supported */ }
        }
    }, [bgPlay, activeId, activeItem ? activeItem.title : '']);

    useEffect(() => {
        // When the user comes back to the app, make sure the background hold is still running.
        const resume = () => {
            if (document.visibilityState === 'visible' && bgPlay && activeId && bgAudioRef.current && bgAudioRef.current.paused) {
                bgAudioRef.current.play().catch(() => { });
            }
        };
        document.addEventListener('visibilitychange', resume);
        return () => document.removeEventListener('visibilitychange', resume);
    }, [bgPlay, activeId]);

    function playVideo(videoId) {
        setStartAt(0);
        playClockRef.current = { startedAt: 0, base: 0, frozenPos: null, hiddenAt: null };
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

    playNextRef.current = playNextQueued;

    reloadRef.current = reloadPlayer;

    return (<div className="yt-app">

      <style>{`

        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');

        :root { color-scheme: dark; font-family: Roboto, Arial, sans-serif; background: #050507; color: #f1f1f1; --sonora-accent: #4c3490; --sonora-accent-hover: #6046ad; --sonora-black: #050507; }

        * { box-sizing: border-box; }

        body { margin: 0; background: #050507; }

        html { scroll-padding-top: 140px; }

        button, input { font: inherit; }

        button { cursor: pointer; }

        .yt-app { min-height: 100vh; background: #050507; color: #f1f1f1; }

        .sonora-intro { position: fixed; inset: 0; z-index: 99999; display: grid; place-items: center; overflow: hidden; background: radial-gradient(ellipse at 50% 42%, #17112b 0%, #0b0912 42%, #030305 100%); transition: opacity .45s ease, visibility .45s ease; }
        .sonora-intro::before, .sonora-intro::after { content: ''; position: absolute; width: min(70vw, 620px); aspect-ratio: 1; border: 1px solid #4c349022; border-radius: 50%; animation: sonora-orbit 7s linear infinite; }
        .sonora-intro::after { width: min(88vw, 780px); border-color: #4c349018; animation-direction: reverse; animation-duration: 11s; }
        .sonora-intro-inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 22px; padding: 24px; text-align: center; }
        .sonora-vinyl-stage { width: 156px; height: 156px; display: grid; place-items: center; perspective: 700px; filter: drop-shadow(0 20px 30px #4c349055); }
        .sonora-vinyl { position: relative; width: 142px; height: 142px; border-radius: 50%; background: repeating-radial-gradient(circle at center, #18191f 0 4px, #2c2d35 5px 6px, #111218 7px 10px); border: 2px solid #45434c; box-shadow: inset 0 0 0 8px #0b0c11, inset 0 0 0 10px #35333b, 0 0 0 5px #4c349012; transform-style: preserve-3d; animation: sonora-vinyl-spin 3.4s linear infinite, sonora-vinyl-float 2.4s ease-in-out infinite; }
        .sonora-vinyl::before { content: ''; position: absolute; inset: 35px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #9b86dc, #6b50b8 38%, #35245f 72%, #17102b); border: 3px solid #b7a6ee; box-shadow: 0 0 22px #4c349077; }
        .sonora-vinyl::after { content: ''; position: absolute; width: 8px; height: 8px; left: calc(50% - 4px); top: calc(50% - 4px); border-radius: 50%; background: #f5e9ee; box-shadow: 0 0 6px #fff; }
        .sonora-loader-orbit { position: absolute; width: 154px; height: 154px; border: 2px solid transparent; border-top-color: #4c3490; border-right-color: #9b86dc; border-radius: 50%; transform: rotateX(64deg) rotateZ(-20deg); animation: sonora-orbit 1.4s linear infinite; }
        .sonora-intro-name { margin: 0; color: #fff; font-size: clamp(30px, 6vw, 43px); font-weight: 800; letter-spacing: .22em; text-indent: .22em; text-shadow: 0 0 26px #4c349066; }
        .sonora-intro-tagline { margin: -13px 0 0; color: #b9b5c4; font-size: 12px; letter-spacing: .22em; text-transform: uppercase; }
        .sonora-equalizer { height: 26px; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .sonora-equalizer span { width: 4px; height: 7px; border-radius: 5px; background: linear-gradient(180deg, #b7a6ee, #4c3490); box-shadow: 0 0 10px #4c349055; animation: sonora-bars .72s ease-in-out infinite alternate; }
        .sonora-equalizer span:nth-child(2n) { animation-delay: .18s; }
        .sonora-equalizer span:nth-child(3n) { animation-delay: .34s; }
        .sonora-loading-caption { margin: -13px 0 0; color: #777483; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
        @keyframes sonora-vinyl-spin { from { rotate: 0deg; } to { rotate: 360deg; } }
        @keyframes sonora-vinyl-float { 0%,100% { translate: 0 0; } 50% { translate: 0 -5px; } }
        @keyframes sonora-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sonora-bars { from { height: 5px; opacity: .65; } to { height: 24px; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .sonora-vinyl, .sonora-loader-orbit, .sonora-intro::before, .sonora-intro::after, .sonora-equalizer span { animation-duration: 2.5s; } }

        .yt-header { height: 64px; padding: 0 4%; display: flex; align-items: center; gap: 22px; position: fixed; top: 0; left: 0; right: 0; z-index: 50; background: #050507; border-bottom: 1px solid #30264b; }

        .yt-brand { display: flex; align-items: center; gap: 8px; color: #f1f1f1; font-weight: 700; font-size: 20px; letter-spacing: -.6px; white-space: nowrap; }

        .yt-brand-icon { color: #f1eced; display: flex; align-items: center; }

        .yt-search { display: flex; width: min(660px, 60vw); margin: 0 auto; height: 40px; }

        .yt-search input { flex: 1; min-width: 0; border: 1px solid #30264b; border-right: 0; border-radius: 22px 0 0 22px; background: #0b0912; padding: 0 18px; color: #f1f1f1; outline: none; }

        .yt-search input:focus { border-color: #4c3490; }

        .yt-search button { width: 64px; display: grid; place-items: center; border: 1px solid #30264b; border-radius: 0 22px 22px 0; background: #191427; color: #f1f1f1; }

        .yt-layout { display: block; margin-top: 64px; min-height: calc(100vh - 64px); }

        .yt-sidebar { padding: 18px 12px; border-right: 1px solid #30264b; }

        .yt-side-button { display: flex; width: 100%; align-items: center; gap: 22px; padding: 12px 16px; border: 0; border-radius: 10px; background: transparent; color: #f1f1f1; text-align: left; }

        .yt-side-button:hover, .yt-side-button.active { background: #191427; }

        .yt-side-note { margin: 22px 14px; color: #aaa; font-size: 12px; line-height: 1.5; }

        .yt-main { width: 100%; max-width: 1600px; padding: 24px clamp(16px, 3vw, 44px) 80px; margin: 0 auto; }

        .yt-pills { display: flex; gap: 10px; overflow-x: auto; padding: 12px 0; margin-bottom: 10px; scrollbar-width: none; -webkit-overflow-scrolling: touch; position: sticky; top: 64px; z-index: 40; background: #050507; border-bottom: 1px solid #30264b; }

        .yt-pill { display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; white-space: nowrap; border: 0; border-radius: 8px; padding: 9px 13px; background: #191427; color: #f1f1f1; font-size: 14px; }

        .yt-pill-count { min-width: 20px; padding: 1px 6px; border-radius: 10px; background: #2c2245; color: #f1f1f1; font-size: 11px; font-weight: 700; line-height: 1.5; text-align: center; }

        .yt-pill.selected .yt-pill-count, .yt-pill:focus .yt-pill-count { background: #ffffff33; color: #fff; }

        .yt-pill.selected { background: #4c3490; color: #fff; box-shadow: 0 4px 14px #4c349044; }

        .yt-add-panel { border: 1px solid #30264b; border-radius: 16px; padding: 18px; margin-bottom: 26px; background: #100d18; }

        .yt-section-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 14px; font-size: 20px; font-weight: 700; }

        .yt-add-form { display: flex; gap: 10px; }

        .yt-add-form input { min-width: 0; flex: 1; border: 1px solid #40345f; border-radius: 10px; padding: 12px 14px; background: #050507; color: #f1f1f1; outline: none; }

        .yt-red-button { border: 0; border-radius: 10px; padding: 0 16px; min-height: 42px; display: inline-flex; justify-content: center; align-items: center; gap: 8px; background: #4c3490; color: #fff; font-weight: 500; white-space: nowrap; }

        .yt-red-button:hover { background: #6046ad; box-shadow: 0 5px 18px #4c349044; }

        .yt-subtle { color: #aaa; font-size: 13px; line-height: 1.5; margin: 12px 0 0; }

        .yt-player-section { margin: 0 0 32px; }

        .yt-player-title { font-size: 18px; margin: 0 0 12px; }

        .yt-player { position: relative; width: 100%; max-width: 1100px; aspect-ratio: 16 / 9; background: #000; overflow: hidden; border-radius: 14px; }
        .yt-loading-overlay { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 20px; background: #0b0b0b; color: #f1f1f1; text-align: center; }
        .yt-loader-spinner { width: 42px; height: 42px; border: 4px solid #454545; border-top-color: #4c3490; border-radius: 50%; animation: sonora-spin .8s linear infinite; }
        .yt-loading-title { font-size: 16px; font-weight: 700; }
        .yt-loading-subtitle { color: #aaa; font-size: 13px; }
        .yt-loading-hint { max-width: 420px; color: #ffd24d; font-size: 13px; line-height: 1.5; }
        @keyframes sonora-spin { to { transform: rotate(360deg); } }

        .yt-player iframe { display: block; width: 100%; height: 100%; border: 0; }
        .yt-player:fullscreen { width: 100vw; height: 100vh; max-width: none; aspect-ratio: auto; border-radius: 0; background: #000; }
        .yt-player:fullscreen .yt-player-frame { width: 100%; height: 100%; }
        .yt-player:fullscreen iframe { width: 100%; height: 100%; }

        .yt-player-empty { width: 100%; max-width: 1100px; aspect-ratio: 16 / 9; display: grid; place-items: center; border-radius: 14px; background: #100d18; color: #aaa; text-align: center; padding: 24px; }

        .yt-player-empty strong { display: block; color: #f1f1f1; margin: 12px 0 6px; }

        .yt-player-empty.yt-resume { position: relative; padding: 0; overflow: hidden; }
        .yt-resume-button { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; padding: 0; background: #000; color: #fff; }
        .yt-resume-button img { width: 100%; height: 100%; object-fit: cover; opacity: .5; display: block; }
        .yt-resume-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 16px; text-align: center; }
        .yt-resume-overlay strong { margin: 4px 0 0; color: #fff; }
        .yt-resume-title { max-width: 90%; font-size: 13px; color: #ddd; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .yt-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; max-width: 1100px; margin: 12px 0 0; }

        .yt-seg { display: inline-flex; border-radius: 18px; overflow: hidden; background: #191427; }

        .yt-seg button { border: 0; background: transparent; color: #f1f1f1; padding: 7px 12px; font-size: 12px; }

        .yt-seg button.on { background: #f1f1f1; color: #0f0f0f; }

        .yt-list-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 0 0 16px; }

        .yt-list-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

        .yt-video-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 18px 12px; }

        .yt-video-card { min-width: 0; }

        .yt-thumb-wrap { position: relative; overflow: hidden; border-radius: 12px; aspect-ratio: 16 / 9; background: #191427; cursor: pointer; border: 0; padding: 0; width: 100%; display: block; text-align: left; }

        .yt-thumb-wrap:focus-visible { outline: 2px solid #9b86dc; outline-offset: 3px; }

        .yt-thumb-overlay { position: absolute; inset: 0; display: grid; place-items: center; background: #0000; transition: background .18s ease; }

        .yt-thumb-wrap:hover .yt-thumb-overlay { background: #0006; }

        .yt-playing-badge { display: inline-flex; align-items: center; gap: 7px; padding: 8px 11px; border-radius: 999px; background: #4c3490; color: white; font-size: 12px; font-weight: 700; box-shadow: 0 4px 18px #0008; }

        .yt-playing-badge svg { animation: sonora-pulse 1.25s ease-in-out infinite; }

        @keyframes sonora-pulse { 50% { opacity: .45; transform: scale(.9); } }

        .yt-player.yt-mini-player { position: fixed; z-index: 20; right: 18px; bottom: 18px; width: min(360px, calc(100vw - 24px)); max-width: none; aspect-ratio: 16 / 9; box-shadow: 0 12px 36px #000b; border: 1px solid #444; }
        .yt-mini-controls { display: none; position: absolute; z-index: 4; top: 8px; right: 8px; gap: 6px; }
        .yt-player.yt-mini-player .yt-mini-controls { display: flex; }
        .yt-mini-controls button { border: 0; border-radius: 18px; background: #171717e8; color: #fff; padding: 7px; display: grid; place-items: center; }
        .yt-cloud-panel { border: 1px solid #30264b; border-radius: 14px; background: #100d18; padding: 16px; margin: 24px 0; }
        .yt-cloud-form { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
        .yt-cloud-form input { flex: 1; min-width: 160px; border: 1px solid #40345f; border-radius: 9px; padding: 10px 12px; background: #050507; color: #f1f1f1; }
        .yt-cloud-form textarea { flex: 1; min-width: 160px; min-height: 84px; resize: vertical; border: 1px solid #40345f; border-radius: 9px; padding: 10px 12px; background: #050507; color: #f1f1f1; font: inherit; }
        .yt-cloud-status { color: #aaa; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
        .yt-history-list { margin-top: 10px; border-top: 1px solid #30264b; }
        .yt-history-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #30264b; }
        .yt-player-frame { position: relative; width: 100%; height: 100%; }

        .yt-thumb { width: 100%; height: 100%; display: block; object-fit: cover; }

        .yt-card-body { display: flex; align-items: flex-start; gap: 10px; padding-top: 12px; }

        .yt-mini-icon { flex: 0 0 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: #191427; color: #4c3490; }

        .yt-card-info { min-width: 0; flex: 1; }

        .yt-card-title { font-size: 15px; line-height: 1.4; font-weight: 500; margin: 0 0 7px; overflow-wrap: anywhere; }

        .yt-card-meta { font-size: 12px; color: #aaa; margin: 0 0 10px; }

        .yt-actions { display: flex; flex-wrap: wrap; gap: 7px; }

        .yt-small-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 10px; border: 0; border-radius: 18px; background: #191427; color: #f1f1f1; font-size: 12px; }

        .yt-small-button:hover { background: #2c2245; }

        .yt-small-button.primary { background: #4c3490; color: #fff; }

        .yt-small-button.danger { color: #b7a6ee; }

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
        .yt-small-button.bg-on { background: #4c3490; color: #fff; }
        .yt-bg-help { max-width: 1100px; margin: 12px 0 0; padding: 14px 16px; border: 1px solid #30264b; border-radius: 12px; background: #100d18; color: #bbb; font-size: 13px; line-height: 1.6; }
        .yt-bg-help strong { color: #f1f1f1; font-size: 14px; }
        .yt-bg-help ol { margin: 8px 0; padding-left: 20px; }
        .yt-bg-help p { margin: 8px 0; }

        /* Button click highlight */
        button { -webkit-tap-highlight-color: #4c349055; }
        .yt-small-button, .yt-pill, .yt-red-button, .yt-side-button, .yt-seg button { transition: background .12s ease, color .12s ease, transform .12s ease, box-shadow .12s ease; }
        .yt-small-button:active:not(:disabled), .yt-small-button.primary:active:not(:disabled), .yt-small-button.danger:active:not(:disabled) { background: #4c3490; color: #fff; transform: scale(.93); box-shadow: 0 0 0 3px #4c349055; }
        .yt-pill:active, .yt-pill.selected:active { background: #4c3490; color: #fff; transform: scale(.96); }
        .yt-red-button:active { background: #30205c; transform: scale(.97); box-shadow: 0 0 0 3px #4c349055; }
        .yt-side-button:active { background: #4c349044; }
        .yt-seg button:active { background: #4c3490; color: #fff; }
        .yt-thumb-wrap:active .yt-thumb-overlay { background: #4c349066; }
        .yt-library-thumb:active { outline: 2px solid #4c3490; }
        .yt-small-button:focus-visible, .yt-pill:focus-visible, .yt-red-button:focus-visible, .yt-side-button:focus-visible { outline: 2px solid #9b86dc; outline-offset: 2px; }
        /* Clicked button keeps the highlight colour (focus) until something else is clicked */
        .yt-small-button:focus:not(:disabled), .yt-small-button.primary:focus:not(:disabled), .yt-small-button.danger:focus:not(:disabled), .yt-seg button:focus { background: #4c3490; color: #fff; }
        .yt-red-button:focus { background: #38256d; box-shadow: 0 0 0 3px #4c349055; }
        .yt-pill.selected, .yt-pill:focus { background: #4c3490; color: #fff; }
        .yt-side-button.active, .yt-side-button:focus { background: #4c3490; color: #fff; }
        .yt-side-button.active:hover, .yt-pill.selected:hover { background: #38256d; }

        /* Library */
        .yt-library-panel { border: 1px solid #30264b; border-radius: 14px; background: #100d18; padding: 16px; margin: 24px 0 34px; }
        .yt-library-target { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: #aaa; font-size: 13px; margin: 4px 0 12px; }
        .yt-library-target select { border: 1px solid #40345f; border-radius: 9px; padding: 8px 10px; background: #050507; color: #f1f1f1; }
        .yt-library-card { border-top: 1px solid #30264b; padding: 12px 0; }
        .yt-library-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
        .yt-library-count { color: #aaa; font-size: 12px; font-weight: 400; margin-left: 8px; }
        .yt-library-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
        .yt-library-thumb { flex: 0 0 96px; width: 96px; aspect-ratio: 16 / 9; border: 0; padding: 0; border-radius: 6px; overflow: hidden; background: #191427; }
        .yt-library-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .yt-library-row .yt-queue-name { flex: 1; min-width: 0; }
        .yt-library-list { height: 420px; overflow-y: auto; overscroll-behavior: auto; padding-right: 4px; }
        .yt-lib-search { display: flex; align-items: center; gap: 8px; height: 38px; margin: 6px 0 12px; padding: 0 12px; border: 1px solid #40345f; border-radius: 22px; background: #050507; color: #aaa; }
        .yt-lib-search:focus-within { border-color: #4c3490; }
        .yt-lib-search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: #f1f1f1; }
        .yt-lib-clear { display: grid; place-items: center; border: 0; background: transparent; color: #aaa; padding: 4px; border-radius: 50%; }
        .yt-lib-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 10px; scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
        .yt-lib-tab { display: inline-flex; align-items: center; gap: 7px; flex: 0 0 auto; white-space: nowrap; border: 0; border-radius: 8px; padding: 8px 13px; background: #191427; color: #f1f1f1; font-size: 13px; transition: background .12s ease, transform .12s ease; }
        .yt-lib-tab:hover { background: #2c2245; }
        .yt-lib-tab:active { transform: scale(.96); }
        .yt-lib-tab.selected { background: #4c3490; color: #fff; }
        .yt-lib-tab.selected .yt-pill-count { background: #ffffff33; color: #fff; }

        .yt-queue { margin: 24px 0 34px; padding: 16px; border: 1px solid #30264b; border-radius: 14px; }

        .yt-queue-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid #30264b; padding: 11px 0; }

        .yt-queue-row:first-of-type { margin-top: 8px; }

        .yt-queue-name { font-size: 14px; overflow-wrap: anywhere; }

        .yt-empty { padding: 36px 16px; text-align: center; color: #aaa; border: 1px dashed #333; border-radius: 14px; }

        .yt-empty strong { display: block; color: #f1f1f1; margin: 12px 0 6px; }

        .yt-toast { position: fixed; z-index: 10; bottom: 20px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 24px); display: flex; align-items: center; gap: 16px; padding: 12px 16px; background: #191427; border: 1px solid #444; border-radius: 10px; box-shadow: 0 8px 30px #0008; font-size: 14px; }

        .yt-toast button { border: 0; background: transparent; color: #f1f1f1; display: flex; }

        .yt-tour-launch { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; border: 1px solid #40345f; border-radius: 18px; background: #100d18; color: #f1f1f1; padding: 7px 12px; font-size: 13px; transition: background .12s ease, color .12s ease, border-color .12s ease; }
        .yt-tour-launch:hover { background: #2a2a2a; }
        .yt-tour-launch:active, .yt-tour-launch:focus { background: #4c3490; color: #fff; border-color: #4c3490; }
        .yt-tour-launch.pulse { border-color: #4c3490; animation: sonora-tour-pulse 1.8s ease-in-out infinite; }
        @keyframes sonora-tour-pulse { 0%, 100% { box-shadow: 0 0 0 0 #4c349000; } 50% { box-shadow: 0 0 0 5px #4c349055; } }
        .yt-tour { position: fixed; inset: 0; z-index: 9000; }
        .yt-tour-blocker { position: absolute; inset: 0; }
        .yt-tour-dim { position: absolute; inset: 0; background: rgba(0, 0, 0, .74); }
        .yt-tour-spot { position: absolute; border-radius: 12px; pointer-events: none; box-shadow: 0 0 0 9999px rgba(0, 0, 0, .74), 0 0 0 3px #4c3490; transition: top .25s ease, left .25s ease, width .25s ease, height .25s ease; }
        .yt-tour-card { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); width: min(440px, calc(100vw - 24px)); max-height: 58vh; overflow-y: auto; padding: 16px; border: 1px solid #444; border-radius: 14px; background: #100d18; color: #f1f1f1; box-shadow: 0 12px 40px #000c; }
        .yt-tour-card.center { top: 50%; bottom: auto; transform: translate(-50%, -50%); }
        .yt-tour-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #aaa; font-size: 12px; }
        .yt-tour-progress { height: 4px; margin: 8px 0 12px; border-radius: 4px; background: #303030; overflow: hidden; }
        .yt-tour-progress span { display: block; height: 100%; background: #4c3490; transition: width .25s ease; }
        .yt-tour-title { margin: 0 0 6px; font-size: 18px; }
        .yt-tour-text { margin: 0; color: #ccc; font-size: 14px; line-height: 1.55; }
        .yt-tour-points { margin: 10px 0 0; padding-left: 18px; color: #ccc; font-size: 13px; line-height: 1.55; }
        .yt-tour-note { margin: 10px 0 0; color: #ffd24d; font-size: 13px; }
        .yt-tour-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 14px; }
        .yt-tour-ghost { border: 0; border-radius: 8px; background: transparent; color: #aaa; padding: 8px 10px; font-size: 13px; }
        .yt-tour-ghost:hover { background: #191427; color: #fff; }
        .yt-tour-ghost:disabled { opacity: .4; cursor: not-allowed; }
        @media (max-width: 700px) { .yt-tour-launch { padding: 7px 10px; font-size: 12px; gap: 5px; } .yt-tour-card { max-height: 55vh; } }

        .yt-brand-logo { width: 32px; height: 32px; border-radius: 8px; object-fit: contain; display: block; }
        
        .yt-toast { overflow: hidden; }
        .yt-toast-text { min-width: 0; overflow-wrap: anywhere; }
        .yt-toast-timer { flex: 0 0 auto; display: grid; place-items: center; min-width: 24px; height: 24px; border: 2px solid #4c3490; border-radius: 50%; color: #fff; font-size: 12px; font-weight: 700; }
        .yt-toast-bar { position: absolute; left: 0; bottom: 0; width: 100%; height: 3px; background: #4c3490; transform-origin: left; animation: sonora-toast-bar 5s linear forwards; }
        @keyframes sonora-toast-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        .yt-menu-button { display: none; background: transparent; border: 0; color: #f1f1f1; }

        @media (max-width: 1050px) { .yt-video-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

        @media (max-width: 700px) { .yt-header { height: 58px; padding: 0 12px; gap: 12px; } .yt-brand { font-size: 17px; } .yt-brand-word { display: none; } .yt-search { width: auto; flex: 1; } .yt-search input { padding: 0 12px; } .yt-search button { width: 46px; } .yt-pills { top: 58px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; overflow: visible; padding: 8px 0; margin-bottom: 8px; } html { scroll-padding-top: 190px; } .yt-layout { margin-top: 58px; min-height: calc(100vh - 58px); } .yt-pill { width: 100%; min-width: 0; justify-content: center; text-align: center; white-space: normal; line-height: 1.2; padding: 7px 4px; font-size: 12px; gap: 4px; } .yt-pill svg { display: none; } .yt-pill-count { min-width: 0; padding: 1px 5px; font-size: 10px; } .yt-main { padding: 16px 12px 60px; } .yt-library-list { height: auto; overflow: visible; padding-right: 0; } .yt-video-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 10px; } .yt-add-form { flex-direction: column; } .yt-add-form .yt-red-button { width: 100%; } .yt-player { border-radius: 9px; } .yt-add-panel { padding: 14px; } .yt-section-title { font-size: 18px; } }

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

        <div className="yt-brand">{logoIndex < LOGO_FILES.length
          ? <img className="yt-brand-logo" src={`${import.meta.env.BASE_URL}${LOGO_FILES[logoIndex]}`} alt="Sonora" onError={() => setLogoIndex((index) => index + 1)}/>
          : <span className="yt-brand-icon"><Youtube size={30} fill="currentColor"/></span>}<span className="yt-brand-word">Sonora</span>
          
          </div>

        <button className={`yt-tour-launch ${tourSeen ? '' : 'pulse'}`} onClick={startTour} title="Guide: take a quick tour of every feature" aria-label="Open the guided tour"><Compass size={16}/><span className="yt-tour-launch-label">Guide</span></button>

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
                    src={getPlayerSrc(mode, activeId, startAt)}
                    title={activeItem ? activeItem.title : 'Sonora player'}
                    onLoad={() => { setPlayerLoading(false); playClockRef.current = { startedAt: Date.now(), base: startAt, frozenPos: null, hiddenAt: null }; }}
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

              </div>) : resumeItem ? (<div className="yt-player-empty yt-resume"><button className="yt-resume-button" onClick={resumeLast} aria-label={`Resume ${resumeItem.title}`}><img src={`https://i.ytimg.com/vi/${resumeItem.videoId}/mqdefault.jpg`} alt=""/><span className="yt-resume-overlay"><Play size={34} fill="white" color="white"/><strong>{resumeSeconds ? `Tap to resume from about ${formatClock(resumeSeconds)}` : 'Tap to resume'}</strong><span className="yt-resume-title">{resumeItem.title}</span></span></button></div>) : (<div className="yt-player-empty"><div><Youtube size={42}/><strong>Your player is ready</strong><span>Add a link or choose a saved video below.</span></div></div>)}



            <div className="yt-toolbar">

              <div className="yt-seg" role="group" aria-label="Player mode">

                <button className={mode === 'adfree' ? 'on' : ''} onClick={() => setMode('adfree')} title="Ad-free site: plays the video through the ad-free player"><ShieldCheck size={13} style={{ verticalAlign: 'middle' }}/> Ad-free site</button>

                {/* <button className={mode === 'official' ? 'on' : ''} onClick={() => setMode('official')}>YouTube embed</button> */}

              </div>

              <button className="yt-small-button icon" onClick={playNextQueued} title="Next in queue: play the next video from your queue" aria-label="Next in queue"><SkipForward size={16}/></button>

              {activeId && <button className="yt-small-button icon" onClick={reloadPlayer} title="Reload player: use this if the video is stuck, blank or paused after the screen turned off (it restarts from about where it stopped)" aria-label="Reload player"><RefreshCw size={16}/></button>}

              {activeId && <button className="yt-small-button icon" title="Full screen: fill the whole screen with the player" aria-label="Full screen" onClick={async () => { const player = document.querySelector('.yt-player'); if (!player) return; try { if (document.fullscreenElement) { await document.exitFullscreen(); } else if (player.requestFullscreen) { await player.requestFullscreen(); } } catch (error) { console.error('Fullscreen could not be opened:', error); } }}><Fullscreen size={16}/></button>}

              {activeItem && <button className="yt-small-button icon" onClick={() => setMiniPlayer((value) => !value)} title={miniPlayer ? 'Expand player: return to the full-size player' : 'Mini player: keep the video floating in the corner while you browse'} aria-label={miniPlayer ? 'Expand player' : 'Mini player'}>{miniPlayer ? <Maximize2 size={16}/> : <PictureInPicture2 size={16}/>}</button>}

              <button className={`yt-small-button icon ${bgPlay ? 'bg-on' : ''}`} onClick={toggleBackgroundPlay} aria-pressed={bgPlay} title={bgPlay ? 'Background play is ON: tap to turn off' : 'Background play: keep the music going when you leave the app or turn off the screen'} aria-label="Background play"><Headphones size={16}/></button>

              <button className="yt-small-button icon" onClick={() => setShowBgHelp((value) => !value)} title="How to keep the music playing in the background" aria-label="Background play help"><Info size={16}/></button>
              {/* {activeItem && <button className="yt-small-button" onClick={copyActiveLink}><Copy size={14}/> Copy link</button>} */}

            </div>

            {showBgHelp && <div className="yt-bg-help" role="note">
              <strong>Play in the background</strong>
              {isIOS ? <p>iPhone and iPad close web pages and installed web apps as soon as you leave them, and Sonora cannot change that. Things you can try: open Sonora in Safari (not from the home screen icon), start the video, open it in full screen and tap the Picture-in-Picture button of the player (if it shows one) before leaving the app.</p> : <ol>
                <li>Tap the headphones button so it turns purple (Background play is on).</li>
                <li>Start a song and keep the full-size player or full screen. Android often pauses the small floating mini player when you leave the app.</li>
                <li>Press Home or switch apps: the video keeps playing in a small floating window. The song should appear in the notification bar, and its Next button plays the next video from your queue.</li>
                <li>When the screen turns off, the player site pauses the video after a few seconds (this also happens on desktop Chrome and Opera, so it is the site and not your phone). When you unlock, tap Reload player or Play in the notification: Sonora restarts the video from about where it stopped, if the player site accepts a start time.</li>
                {!isStandalone && <li>For the best result install Sonora first: browser menu, then Add to Home screen or Install app, and open it from the home screen.</li>}
              </ol>}
              <p>Background play also depends on your phone and on the video player site, so it may not work for every video. The Play and Pause buttons in the notification may not control the video itself.</p>
              {!isIOS && <button className="yt-small-button" onClick={openPlayerFullscreen}><Fullscreen size={14}/> Open full screen now</button>}
            </div>}



            {/* {activeItem && <p className="yt-subtle">If the player stays blank, the site may block embedding: switch the player mode, reload, or <a href={activeItem.url} target="_blank" rel="noopener noreferrer" style={{ color: '#9b86dc' }}>open appended link <ArrowUpRight size={13} style={{ verticalAlign: 'middle' }}/></a>. Note: auto-play of the next queued video is not possible with an embedded third-party site, so use "Next in queue".</p>} */}

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
                      <button className="yt-small-button icon" onClick={() => addToQueue(video)} title="Add to queue: play this video after the ones already waiting" aria-label="Add to queue"><ListPlus size={14}/></button>
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

                  <button className="yt-small-button icon" onClick={() => toggleFavorite(item.videoId)} title={favorites.includes(item.videoId) ? 'Remove from favorites' : 'Add to favorites'} aria-label={favorites.includes(item.videoId) ? 'Remove from favorites' : 'Add to favorites'} style={{ color: favorites.includes(item.videoId) ? '#9b86dc' : undefined }}><Heart size={14} fill={favorites.includes(item.videoId) ? 'currentColor' : 'none'}/></button>
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



      {tourStep !== null && (() => {
        const step = TOUR_STEPS[tourStep];
        const spot = tourRect && !tourRect.missing ? tourRect : null;
        return (<div className="yt-tour" role="dialog" aria-modal="true" aria-label="Sonora guided tour">
          <div className="yt-tour-blocker" />
          {spot ? <div className="yt-tour-spot" style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} /> : <div className="yt-tour-dim" />}
          <div className={`yt-tour-card ${step.target ? '' : 'center'}`}>
            <div className="yt-tour-meta"><span>Step {tourStep + 1} of {TOUR_STEPS.length}</span><button className="yt-tour-ghost" onClick={closeTour}>Skip tour</button></div>
            <div className="yt-tour-progress"><span style={{ width: `${((tourStep + 1) / TOUR_STEPS.length) * 100}%` }} /></div>
            <h3 className="yt-tour-title">{step.title}</h3>
            <p className="yt-tour-text">{step.text}</p>
            {step.points && <ul className="yt-tour-points">{step.points.map((point) => <li key={point}>{point}</li>)}</ul>}
            {step.target && tourRect && tourRect.missing && <p className="yt-tour-note">This section appears after you add something to it.</p>}
            <div className="yt-tour-actions">
              <button className="yt-tour-ghost" onClick={tourBack} disabled={tourStep === 0}>Back</button>
              <button className="yt-red-button" onClick={tourNext}>{tourStep === TOUR_STEPS.length - 1 ? 'Done' : 'Next'}</button>
            </div>
          </div>
        </div>);
      })()}

      {notice && <div className="yt-toast" role="status" key={noticeStamp}>
        <span className="yt-toast-text">{notice}</span>
        <span className="yt-toast-timer" title={`Closes in ${noticeLeft} seconds`} aria-label={`Closes in ${noticeLeft} seconds`}>{noticeLeft}</span>
        <button onClick={() => setNotice('')} aria-label="Dismiss notification" title="Close"><X size={16}/></button>
        <span className="yt-toast-bar" style={{ animationDuration: `${NOTICE_SECONDS}s` }} />
      </div>}

    </div>);

}
