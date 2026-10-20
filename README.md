# Sonora — Personal Music Library

React + Vite music player designed for desktop and Android browsers.

## Features
- Import audio files from your device
- Store imported tracks locally with IndexedDB so they persist after refresh
- Play, pause, seek, volume, shuffle/repeat, likes, rename and delete imported tracks
- Free music discovery links (check each source's license and terms)
- Storage estimate and library backup/restore features
- Installable PWA shell and basic offline caching for app assets
- Responsive dark neon theme

## Requirements
- Node.js 18+ recommended
- npm

## Run locally
```bash
npm install
npm run dev
```
Open the local URL Vite prints.

## Build
```bash
npm run build
npm run preview
```

## Android install
Deploy to an HTTPS host, open the site in Chrome on Android, then choose **Install app** or **Add to Home screen** from the browser menu. Service workers and install prompts require a secure context (localhost is also secure for development).

## Storage notes
Audio is stored in this browser profile on this device using IndexedDB. It does not sync to another device. Browser storage can be removed by clearing site data, and browsers may enforce quotas or evict data. Use the in-app backup/restore option regularly. Browser storage persistence can be requested but is not guaranteed.

## Free music notes
The app links to external music sources; availability, streaming and download rights depend on each provider and track license. A saved YouTube link is not an audio download. Only import audio you own or are authorized to use.

## Limitations
- No cloud sync or account system.
- Offline caching covers the app shell only, not external music websites or their streams.
- Background playback depends on Android/browser behavior and device battery settings.


## Deploy to GitHub Pages

This project is configured for a repository named `sonora-music-app` (the site URL will be `https://YOUR-GITHUB-USERNAME.github.io/sonora-music-app/`). If your repository has a different name, update `base` in `vite.config.js` and the `/sonora-music-app/` paths in `public/manifest.webmanifest` before deploying.

1. Upload the contents of this folder to the **root** of your GitHub repository, including `.github/workflows/deploy.yml`.
2. Do not upload `node_modules` or personal audio files. The workflow installs dependencies and builds the app.
3. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and wait for **Deploy Sonora to GitHub Pages** to finish successfully.
5. Open `https://YOUR-GITHUB-USERNAME.github.io/sonora-music-app/`.

The app stores imported audio in the current browser/device using IndexedDB; it does not automatically sync audio between devices. Use the in-app backup feature for your library.
