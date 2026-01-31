# ClipBeat

Identify songs from Instagram Reels, TikTok, and YouTube Shorts—even when someone's talking over the music.

## Quick start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your keys (see below)
npx convex dev   # Creates Convex project, deploys schema, generates types
npm start
```

Then press **`w`** for web, **`i`** for iOS simulator, or scan QR for physical device.

---

## Setup (detailed)

### 1. Install dependencies

```bash
npm install
```

### 2. Local environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `EXPO_PUBLIC_CONVEX_URL` | Yes | Convex dashboard → Settings → URL |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | [Clerk dashboard](https://dashboard.clerk.com) → API Keys |

### 3. Convex

```bash
npx convex dev
```

Creates a Convex project (if needed), deploys schema, generates types. Keep this running while developing.

### 4. Clerk (auth)

1. Create a project at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Enable **Apple Sign-In** and **Google Sign-In**
3. Create a JWT template named `convex` and copy the **Issuer URL**
4. In Convex dashboard → Settings → Environment Variables, add:
   - `CLERK_JWT_ISSUER_DOMAIN` = your Issuer URL

### 5. Pipeline API keys (Convex dashboard)

Set these in **Convex dashboard → Settings → Environment Variables**. Jobs will fail until at least download + recognition are configured.

**Download** (pick one):

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `YT_DLP_SERVICE_URL` | If using yt-dlp | Your self-hosted yt-dlp service URL (e.g. Railway, Fly.io) |
| `YT_DLP_API_KEY` | If using yt-dlp | API key for your yt-dlp service |
| `APIFY_API_TOKEN` | If using Apify | [Apify Console](https://console.apify.com) → Settings → Integrations → API token |

**Audio extraction** (only if Apify returns video without audio):

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `CONVERTAPI_SECRET` | When Apify gives video only | [ConvertAPI](https://www.convertapi.com) → Sign up (250 free conversions) |

**Vocal removal:**

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `REPLICATE_API_TOKEN` | Yes (for voiceover-heavy clips) | [Replicate](https://replicate.com) → Account → API tokens |

**Music recognition:**

| Variable | Required | Where to get it |
|----------|----------|-----------------|
| `ACRCLOUD_HOST` | Yes | `identify-us-west-2.acrcloud.com` (or your region) |
| `ACRCLOUD_ACCESS_KEY` | Yes | [ACRCloud Console](https://console.acrcloud.com) |
| `ACRCLOUD_ACCESS_SECRET` | Yes | [ACRCloud Console](https://console.acrcloud.com) |

---

## Run

```bash
npm start
```

- **`w`** – Web browser (Convex, Clerk, UI work; share extension & ShazamKit do not)
- **`i`** – iOS simulator
- **`a`** – Android emulator
- Scan QR code – Physical device

**Share extension** (iOS only): `npx expo prebuild` then `npx expo run:ios`

## Project structure

- `app/` - Expo Router screens
- `convex/` - Backend (schema, jobs, pipeline)
- `convex/lib/` - Download, audio separation, recognition modules
- `components/` - Shared UI components
- `constants/` - Theme, colors
- `lib/` - Convex client, share intent

## Pipeline flow

1. Download video/audio (yt-dlp service primary, Apify fallback)
2. Store audio in Convex, try ACRCloud on original
3. If no match: Demucs vocal removal → ACRCloud on stripped
4. Save songs, send push notification
