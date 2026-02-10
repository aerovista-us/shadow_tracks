# Shadow Album Player (PWA)

Offline-first audio player starter that matches the "shadow / swampy neon" vibe.

## Run locally (recommended)
Service workers require `http://` or `https://` (not `file://`).

### Option A: Python
```bash
cd shadow_album_player_pwa
python -m http.server 8080
```
Open: http://localhost:8080

### Option B: Node
```bash
npx serve .
```

## Add your real tracks
1) Put your files in `audio/` (mp3/wav/ogg).
2) Edit `tracks` array in `app.js` and set `file: "audio/yourfile.mp3"`

Tip: keep filenames short (e.g., `bad_habits.mp3`) for clean deploys.

## Deploy
Works great on GitHub Pages, Firebase Hosting, or any static host.
