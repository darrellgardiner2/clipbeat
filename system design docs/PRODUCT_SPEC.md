# ClipBeat - Product Specification

## Product Vision

**One-liner:** Instantly identify songs from Instagram Reels, even when someone's talking over the music.

**Problem:** Finding songs from social media clips is frustrating. Shazam fails when there's voiceover, the audio is sped up, or effects are applied. The current workaround (download → CapCut → remove voice → Shazam) takes 2-3 minutes per clip.

**Solution:** Share any reel to ClipBeat → we strip vocals, clean the audio, and identify the track in the background → push notification with results + streaming links.

**Platform:** iOS exclusive (no Android planned)

---

## Target Users

### Primary: Music Enthusiasts
- Hear songs in reels and want to save them
- Build playlists from discovered tracks
- Casual users, 2-5 identifications per week

### Secondary: Content Creators (Ages 18-34)
- Create 5-20 pieces of content per week
- Constantly hunting for trending sounds
- Need songs for their own videos

### Tertiary: Casual Social Media Users
- Occasionally want to identify a song
- Low frequency, high convenience expectation

---

## Core User Flows

### Flow 1: First-Time User (Cold Start)
```
App Store → Install → Open app
        ↓
Onboarding (3 screens):
  1. "Find any song from any reel"
  2. "Just share to ClipBeat"
  3. "We'll notify you when found"
        ↓
Sign in (Apple/Google) or Skip
        ↓
Empty state with clear CTA:
  "Share your first reel to get started"
```

### Flow 2: Share & Detect (Happy Path)
```
Instagram/TikTok → Share → ClipBeat
        ↓
App opens briefly (< 1 sec)
Shows: "Got it! We're on it 🎵"
        ↓
User returns to Instagram/TikTok
        ↓
Background processing (15-45 sec)
        ↓
Push notification:
  "Song Found! 🎵"
  "Blinding Lights by The Weeknd"
        ↓
Tap notification → Job detail screen
        ↓
One-tap to Spotify/Apple Music/YouTube
```

### Flow 3: Detection Failed
```
Processing completes → No match found
        ↓
Push notification:
  "Couldn't identify this one 😕"
  "Tap to see details"
        ↓
Job detail shows:
  - "No song found" state
  - Possible reasons (too edited, not in database, etc.)
  - "Try with a different clip" suggestion
  - Option to submit for manual review (future feature)
```

### Flow 4: Upgrade Prompt
```
Free user hits daily limit (3 detections)
        ↓
Share intent triggers limit modal:
  "You've used your 3 free detections today"
  "Upgrade to Pro for unlimited"
        ↓
Options:
  - "Upgrade · $4.99/mo" (primary)
  - "Remind me tomorrow" (dismiss)
  - "Priority Processing · $0.99" (one-time, faster processing)
```

### Flow 5: Paste URL (Fallback)
```
User opens app → Taps "Paste URL" button
        ↓
Paste from clipboard (auto-detect) or manual entry
        ↓
Validate URL format (Instagram/TikTok/YouTube)
        ↓
Same flow as share extension
```

### Flow 6: Offline Share
```
User shares while offline
        ↓
URL saved to local queue (AsyncStorage)
        ↓
Toast: "Saved! We'll process when you're back online"
        ↓
On reconnect → auto-process queued URLs
```

### Flow 7: Duplicate URL (System-wide)
```
User shares URL that was already processed (by anyone)
        ↓
System detects duplicate via sourceUrl index
        ↓
Skip processing, return cached result immediately
        ↓
Toast: "We already know this one! 🎵"
```

### Flow 8: Referral
```
User taps "Share ClipBeat" in Settings
        ↓
Generates unique referral link: clipbeat.app/r/ABC123
        ↓
Friend downloads and signs up
        ↓
Both get 5 days Pro free
        ↓
Push notification: "Your friend joined! Enjoy 5 free Pro days"
```

---

## Feature Breakdown

### P0 - MVP (Flexible scope)
Core functionality for first TestFlight.

| Feature | Description | Priority | Status |
|---------|-------------|----------|--------|
| Share Extension | Receive URLs from iOS share sheet (Instagram first) | Must | Designed |
| Paste URL Fallback | Manual URL entry in-app | Must | TODO |
| Job Queue | Background processing pipeline | Must | Designed |
| Video Download | yt-dlp primary, Apify backup | Must | Designed |
| Recognition Pipeline | Try original → strip vocals → segment analysis | Must | Designed |
| On-device ShazamKit | Primary recognition engine | Must | TODO |
| ACRCloud Fallback | Secondary recognition (free tier) | Must | Designed |
| Job History | List of past detections | Must | Designed |
| Job Detail | Progress + results screen | Must | Designed |
| Push Notifications | Alert when job completes | Must | Designed |
| Basic Auth | Apple/Google sign-in via Clerk | Must | Designed |
| Duplicate Detection | System-wide URL deduplication | Must | TODO |
| Offline Queue | Save URLs when offline, process on reconnect | Should | TODO |
| First Day Unlimited | No limits on day 1, then 3/day free | Should | TODO |

### P1 - Polish & Platform Support
Better UX and additional platforms.

| Feature | Description | Status |
|---------|-------------|--------|
| TikTok Support | Download from TikTok URLs | TODO |
| YouTube Shorts Support | Download from YouTube Shorts URLs | TODO |
| Onboarding | 3-screen intro explaining the app | TODO |
| Empty States | Helpful messaging when no data | TODO |
| Error Handling | Graceful failures with retry options | TODO |
| Loading States | Skeleton screens, progress indicators | TODO |
| Haptic Feedback | Subtle vibrations on key actions | TODO |
| Deep Links | `clipbeat://job/123` for notifications | TODO |
| Analytics | Track funnel, feature usage | TODO |
| Storage Cleanup Cron | Delete temp files after 24h | TODO |

### P2 - Monetization
Revenue generation.

| Feature | Description | Status |
|---------|-------------|--------|
| Pro Subscription | $4.99/mo unlimited detections | TODO |
| Priority Processing | $0.99 one-time faster processing | TODO |
| RevenueCat Integration | Handle iOS subscriptions | TODO |
| Paywall Screen | Upgrade prompt UI | TODO |
| Restore Purchases | Required by App Store | TODO |
| Referral Program | 5 days Pro free for referrer + referee | TODO |

### P3 - Growth & Virality
Features to drive organic growth.

| Feature | Description | Status |
|---------|-------------|--------|
| Trending on ClipBeat | Public page of most-detected songs | TODO |
| Share Results | "Found with ClipBeat" branded card | TODO |
| Playlist Integration | Add to Spotify/Apple Music directly | TODO |
| Saved Sounds Library | Bookmark songs for later | TODO |
| Widget | iOS widget showing recent finds | TODO |

### P4 - Future (If successful)
Advanced features for power users.

| Feature | Description | Status |
|---------|-------------|--------|
| Bulk Detection | Upload multiple URLs at once | TODO |
| API Access | Programmatic detection for third-party apps | TODO |
| Detection History Export | CSV/JSON export | TODO |

---

## Screens & Components

### Screen Inventory

| Screen | Route | Purpose |
|--------|-------|---------|
| Onboarding | `/onboarding` | First-time user introduction |
| History | `/(tabs)/` | List of all jobs |
| Trending | `/(tabs)/trending` | Most-detected songs (public data) |
| Settings | `/(tabs)/settings` | Account, subscription, support |
| Job Detail | `/job/[id]` | Progress and results |
| Sign In | `/sign-in` | Authentication |
| Paywall | `/paywall` | Subscription upgrade |
| Paste URL | `/paste` | Manual URL entry fallback |
| Referral | `/referral` | Share referral link |

### Shared Components Needed

```
components/
├── ui/
│   ├── Button.tsx           # Primary, secondary, ghost variants
│   ├── Card.tsx             # Consistent card styling
│   ├── Badge.tsx            # Status badges (Pro, Free, etc.)
│   ├── Skeleton.tsx         # Loading placeholders
│   ├── Toast.tsx            # Success/error notifications
│   └── Modal.tsx            # Bottom sheets, alerts
├── job/
│   ├── JobCard.tsx          # Job list item
│   ├── JobProgress.tsx      # Animated progress indicator
│   ├── SongResult.tsx       # Song display with artwork
│   └── StreamingLinks.tsx   # Spotify/Apple/YouTube buttons
├── common/
│   ├── EmptyState.tsx       # No data messaging
│   ├── ErrorState.tsx       # Error with retry
│   ├── Avatar.tsx           # User avatar
│   └── PlatformIcon.tsx     # Instagram/TikTok/YouTube icons
└── paywall/
    ├── PlanCard.tsx         # Free vs Pro comparison
    ├── FeatureList.tsx      # Checkmark feature list
    └── PriceTag.tsx         # Price display
```

---

## Design System

### Colors

```typescript
const colors = {
  // Brand
  primary: '#FF6B35',      // Orange - main brand color
  primaryDark: '#E55A2B',  // Hover/pressed state
  
  // Backgrounds
  bg: '#000000',           // Pure black background
  bgElevated: '#111111',   // Cards, elevated surfaces
  bgSubtle: '#1A1A1A',     // Subtle backgrounds
  
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  textMuted: '#666666',
  textDisabled: '#444444',
  
  // Semantic
  success: '#4CAF50',
  error: '#FF4444',
  warning: '#FFB020',
  info: '#2196F3',
  
  // Platforms
  spotify: '#1DB954',
  appleMusic: '#FC3C44',
  youtube: '#FF0000',
  instagram: '#E4405F',
  tiktok: '#000000',
};
```

### Typography

```typescript
const typography = {
  // Headings
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  h2: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  h3: { fontSize: 20, fontWeight: '600', lineHeight: 26 },
  
  // Body
  bodyLarge: { fontSize: 18, fontWeight: '400', lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  
  // UI
  button: { fontSize: 16, fontWeight: '600', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
};
```

### Spacing

```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

### Border Radius

```typescript
const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};
```

### Shadows (iOS)

```typescript
const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  glow: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
};
```

---

## Animations

### Key Moments to Animate

1. **Share received** - Quick pulse/checkmark when URL is captured
2. **Processing progress** - Smooth status transitions
3. **Song found** - Artwork scales up with glow effect
4. **Streaming buttons** - Staggered entrance
5. **Empty state** - Subtle floating icon
6. **Pull to refresh** - Custom refresh indicator

### Libraries

- **react-native-reanimated** - Already included, use for complex animations
- **Moti** - Simple declarative animations (consider adding)

### Example: Song Found Animation

```typescript
// When job.status changes to "completed"
const artworkScale = useSharedValue(0.8);
const artworkOpacity = useSharedValue(0);

useEffect(() => {
  if (job?.status === 'completed') {
    artworkScale.value = withSpring(1, { damping: 12 });
    artworkOpacity.value = withTiming(1, { duration: 300 });
  }
}, [job?.status]);
```

---

## Error Handling Strategy

### Network Errors

| Scenario | User Message | Action |
|----------|--------------|--------|
| No internet | "No connection. We'll retry when you're back online." | Auto-retry when connected |
| Server down | "Our servers are taking a break. Try again in a few minutes." | Manual retry button |
| Timeout | "This is taking longer than usual. Retrying..." | Auto-retry with backoff |

### Processing Errors

| Scenario | User Message | Action |
|----------|--------------|--------|
| Download failed | "Couldn't access this video. It might be private." | Link to original post |
| Audio extraction failed | "Something went wrong processing this video." | Retry or contact support |
| Recognition failed | "Couldn't identify the song. The audio might be too edited." | Show tips for better results |
| Rate limited | "You've hit your daily limit." | Show upgrade option |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Duplicate URL submitted | Detect and show existing job result |
| Private/deleted video | Show error immediately before processing |
| Very long video (>5 min) | Warn user, process first 60 seconds only |
| No audio in video | Detect and show helpful error |
| Invalid URL format | Validate before creating job |

---

## Analytics Events

### Funnel Events

```typescript
// Onboarding
'onboarding_started'
'onboarding_completed'
'onboarding_skipped'

// Authentication
'sign_in_started'
'sign_in_completed'
'sign_in_method' // { method: 'apple' | 'google' }

// Core Flow
'share_received' // { platform: 'instagram' | 'tiktok' | 'youtube' }
'job_created'
'job_completed' // { success: boolean, duration_ms: number }
'job_viewed'
'streaming_link_tapped' // { service: 'spotify' | 'apple_music' | 'youtube' }

// Monetization
'paywall_viewed' // { trigger: 'limit_reached' | 'settings' | 'queue_skip' }
'purchase_started' // { product: 'pro_monthly' | 'queue_skip' }
'purchase_completed' // { product, price }
'purchase_failed' // { product, error }

// Engagement
'app_opened' // { source: 'direct' | 'notification' | 'share_extension' }
'notification_tapped'
'result_shared'
```

### User Properties

```typescript
{
  tier: 'free' | 'pro',
  total_detections: number,
  successful_detections: number,
  days_since_signup: number,
  last_active_date: string,
}
```

---

## App Store Preparation

### Required Assets

| Asset | Size | Notes |
|-------|------|-------|
| App Icon | 1024x1024 | No transparency, no rounded corners |
| iPhone Screenshots | 1290x2796 (6.7") | 3-5 screens |
| iPhone Screenshots | 1179x2556 (6.1") | 3-5 screens |
| iPad Screenshots | 2048x2732 | Optional for v1 |
| App Preview Video | 1080x1920 | Optional but recommended |

### App Store Listing

**App Name:** ClipBeat - Find Reel Songs

**Subtitle:** Identify music from any video

**Keywords:** 
```
song finder, music identifier, shazam alternative, reel music, 
tiktok song, instagram music, find song, detect music, 
song recognition, what song is this
```

**Description:**
```
Ever hear a song in a reel but can't figure out what it is? 
Shazam doesn't work because someone's talking over it?

ClipBeat solves this. Just share any Instagram Reel or TikTok 
to ClipBeat – we remove the vocals, clean up the audio, and 
identify the track. Even heavily edited, sped up, or remixed 
audio works.

HOW IT WORKS
1. Find a reel with music you want to identify
2. Tap Share → ClipBeat
3. Get a notification when the song is found
4. One tap to listen on Spotify, Apple Music, or YouTube

FEATURES
• Works with voiceovers and talking
• Handles sped up and pitch-shifted audio
• Identifies multiple songs in one clip
• Direct links to streaming services
• Save your detection history

FREE TO USE
Get 3 free song detections every day. Upgrade to Pro for 
unlimited detections and priority processing.

Finally, find that song stuck in your head.
```

**Privacy Policy URL:** https://clipbeat.app/privacy

**Support URL:** https://clipbeat.app/support

### Privacy Nutrition Label

| Data Type | Collected | Linked to Identity | Tracking |
|-----------|-----------|-------------------|----------|
| Email | Yes | Yes | No |
| User ID | Yes | Yes | No |
| Purchase History | Yes | Yes | No |
| Usage Data | Yes | No | No |
| Diagnostics | Yes | No | No |

### App Review Notes

```
Test Account: test@clipbeat.app / TestPassword123

How to test:
1. Open Instagram app
2. Find any reel with music
3. Tap Share button
4. Select ClipBeat from share sheet
5. App opens briefly and starts processing
6. Wait ~30 seconds for push notification
7. Tap notification to see results

Note: The share extension requires a real Instagram/TikTok 
URL to function. We do not access any user data from these 
platforms - we only process the public video URL.
```

---

## Launch Checklist

### Pre-Launch (Week before)

- [ ] All P0 features complete and tested
- [ ] App Store assets created
- [ ] Privacy policy live
- [ ] Support email configured
- [ ] Analytics implemented
- [ ] Error tracking (Sentry) configured
- [ ] Backend scaled for initial load
- [ ] TestFlight beta with 10+ testers
- [ ] All critical bugs fixed

### Launch Day

- [ ] Submit to App Store review
- [ ] Prepare launch announcement
- [ ] Monitor error rates closely
- [ ] Have rollback plan ready

### Post-Launch (First week)

- [ ] Respond to all App Store reviews
- [ ] Monitor crash reports
- [ ] Analyze funnel drop-offs
- [ ] Collect user feedback
- [ ] Prioritize P1 features based on data

---

## Decisions Made

1. **Recognition Strategy:** On-device ShazamKit primary, ACRCloud (free tier) as fallback
2. **Video Download:** yt-dlp primary, Apify as backup
3. **Platform:** iOS exclusive, no Android planned
4. **Pricing:** $4.99/mo Pro, $0.99 Priority Processing
5. **Free Tier:** First day unlimited, then 3/day
6. **Duplicate Detection:** System-wide (not per-user)
7. **Legal:** Not a concern for this project

## Open Questions

1. **Minimum iOS version** - iOS 15 gives us 95%+ coverage. Go lower for more reach or higher for better APIs?

2. **Localization** - English only for v1? Which languages next?

3. **Trending Page** - Public web page or in-app only?

---

## Success Metrics

### North Star Metrics
1. **Successful Detections** - Total songs successfully identified
2. **App Shares** - Users sharing ClipBeat with new users (referral program usage)

### Supporting Metrics

| Metric | Target (Month 1) | Target (Month 3) |
|--------|------------------|------------------|
| Daily Active Users | 500 | 5,000 |
| Detection Success Rate | 70% | 80% |
| Referral Conversion | 5% | 10% |
| Free → Pro Conversion | 2% | 3% |
| D1 Retention | 30% | 40% |
| D7 Retention | 15% | 25% |
| App Store Rating | 4.0+ | 4.5+ |
| MRR | $250 | $2,500 |
