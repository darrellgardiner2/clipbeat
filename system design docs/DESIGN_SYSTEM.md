# ClipBeat Design System

## Overview

ClipBeat uses a dark-first design language that feels native to the Instagram/TikTok ecosystem while maintaining its own identity. The design prioritizes:

1. **Speed** - Users come from social apps, get them back quickly
2. **Clarity** - Song info is the hero, everything else supports it
3. **Delight** - Small moments of joy (animations, haptics)

---

## Brand Identity

### Logo Concept

**Mark:** Abstract soundwave forming a "play" button shape
**Wordmark:** "ClipBeat" in custom semi-bold sans-serif
**Icon:** Simplified mark for app icon and favicons

### Brand Voice

- **Confident** - "We found your song" not "We think this might be..."
- **Quick** - Short, punchy copy
- **Friendly** - Not corporate, like talking to a friend
- **Music-native** - Uses music terminology naturally

### Copy Examples

| Context | ❌ Don't | ✅ Do |
|---------|----------|-------|
| Empty state | "You have no detection history" | "Your finds will show up here" |
| Processing | "Please wait while we process" | "On it! 🎵" |
| Success | "Detection completed successfully" | "Found it!" |
| Error | "An error has occurred" | "Hmm, couldn't catch that one" |
| Upgrade | "Purchase premium subscription" | "Go Pro" |

---

## Color Palette

### Primary Colors

```scss
$primary: #FF6B35;        // ClipBeat Orange - CTAs, accents
$primary-dark: #E55A2B;   // Pressed states
$primary-light: #FF8C5A;  // Highlights

// Usage:
// - Primary buttons
// - Active tab indicators
// - Links
// - Progress indicators
// - Brand moments
```

### Background Colors

```scss
$bg-base: #000000;        // App background
$bg-elevated: #111111;    // Cards, modals
$bg-subtle: #1A1A1A;      // Input backgrounds, secondary cards
$bg-hover: #222222;       // Hover states on dark surfaces

// Hierarchy:
// Base → Elevated → Subtle (increasing lightness)
```

### Text Colors

```scss
$text-primary: #FFFFFF;   // Headings, important text
$text-secondary: #888888; // Body text, descriptions
$text-muted: #666666;     // Captions, timestamps
$text-disabled: #444444;  // Disabled states

// Contrast ratios (on $bg-base):
// Primary: 21:1 ✓
// Secondary: 5.3:1 ✓
// Muted: 4:1 ✓ (large text only)
```

### Semantic Colors

```scss
$success: #4CAF50;        // Found, complete, active
$error: #FF4444;          // Failed, destructive
$warning: #FFB020;        // Limit warnings
$info: #2196F3;           // Tips, info states

// Success tints for backgrounds
$success-bg: #1A2E1A;     // Dark green background
$error-bg: #2E1A1A;       // Dark red background
```

### Platform Colors

```scss
$spotify: #1DB954;
$apple-music: #FC3C44;
$youtube: #FF0000;
$instagram: #E4405F;
$tiktok: #000000;         // Use with white border on dark bg
```

---

## Typography

### Font Stack

```typescript
const fontFamily = {
  // iOS will use SF Pro automatically
  // Android will use Roboto
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
};
```

### Type Scale

```typescript
const typography = {
  // Display - App title, big moments
  display: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 41,
    letterSpacing: 0.37,
  },
  
  // Headings
  h1: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: 0.36,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: 0.35,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
    letterSpacing: 0.38,
  },
  
  // Body
  bodyLarge: {
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: -0.41,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: -0.24,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: -0.08,
  },
  
  // UI Elements
  button: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.41,
  },
  buttonSmall: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.24,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    letterSpacing: -0.08,
    textTransform: 'uppercase',
  },
};
```

---

## Spacing System

### Base Unit: 4px

```typescript
const spacing = {
  xxs: 2,   // Tight spacing (icon padding)
  xs: 4,    // Minimal spacing
  sm: 8,    // Related elements
  md: 16,   // Standard padding
  lg: 24,   // Section spacing
  xl: 32,   // Large gaps
  xxl: 48,  // Screen sections
  xxxl: 64, // Major sections
};
```

### Common Patterns

```typescript
// Card padding
padding: spacing.md // 16

// List item padding
paddingVertical: spacing.sm + spacing.xs // 12
paddingHorizontal: spacing.md // 16

// Section margin
marginBottom: spacing.lg // 24

// Screen padding
padding: spacing.md // 16
```

---

## Border Radius

```typescript
const radius = {
  xs: 4,    // Small chips, tags
  sm: 8,    // Buttons, inputs
  md: 12,   // Cards
  lg: 16,   // Large cards, modals
  xl: 24,   // Bottom sheets
  full: 9999, // Pills, avatars
};
```

---

## Shadows & Elevation

### iOS Shadows

```typescript
const shadows = {
  none: {},
  
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  
  // Special: Glow effect for artwork
  glow: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
};
```

---

## Component Library

### Button

```typescript
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
  onPress: () => void;
}

// Sizes
const buttonSizes = {
  sm: { height: 32, paddingHorizontal: 12, fontSize: 14 },
  md: { height: 44, paddingHorizontal: 20, fontSize: 16 },
  lg: { height: 52, paddingHorizontal: 24, fontSize: 17 },
};

// Variants
const buttonVariants = {
  primary: {
    bg: '#FF6B35',
    bgPressed: '#E55A2B',
    text: '#FFFFFF',
  },
  secondary: {
    bg: '#222222',
    bgPressed: '#333333',
    text: '#FFFFFF',
  },
  ghost: {
    bg: 'transparent',
    bgPressed: '#222222',
    text: '#FF6B35',
  },
  danger: {
    bg: '#FF4444',
    bgPressed: '#CC3333',
    text: '#FFFFFF',
  },
};
```

### Card

```typescript
interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

// Base styles
const cardStyles = {
  backgroundColor: '#111111',
  borderRadius: 12,
  overflow: 'hidden',
};
```

### Input

```typescript
interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardType;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  leftIcon?: IconName;
  rightIcon?: IconName;
}

const inputStyles = {
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 12,
    height: 48,
  },
  focused: {
    borderColor: '#FF6B35',
  },
  error: {
    borderColor: '#FF4444',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  placeholder: {
    color: '#666666',
  },
};
```

### Badge

```typescript
type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'pro';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: IconName;
}

const badgeVariants = {
  default: { bg: '#333333', text: '#888888' },
  success: { bg: '#1A2E1A', text: '#4CAF50' },
  warning: { bg: '#2E2A1A', text: '#FFB020' },
  error: { bg: '#2E1A1A', text: '#FF4444' },
  pro: { bg: '#FF6B35', text: '#000000' },
};
```

### Toast

```typescript
type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

// Position: Bottom of screen, above tab bar
// Animation: Slide up + fade in
// Auto-dismiss: 3 seconds default
```

### Skeleton

```typescript
interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
}

// Animated gradient from #1A1A1A to #2A2A2A
// Use for loading states
```

### Avatar

```typescript
interface AvatarProps {
  size: 'sm' | 'md' | 'lg';
  source?: ImageSource;
  name?: string; // For fallback initials
}

const avatarSizes = {
  sm: 32,
  md: 48,
  lg: 64,
};
```

---

## Icons

### Icon Library: Ionicons

Already included in Expo. Consistent with iOS aesthetic.

### Common Icons Used

```typescript
const icons = {
  // Navigation
  home: 'home-outline',
  homeActive: 'home',
  settings: 'settings-outline',
  settingsActive: 'settings',
  back: 'chevron-back',
  close: 'close',
  
  // Actions
  share: 'share-outline',
  retry: 'refresh',
  play: 'play',
  
  // Status
  success: 'checkmark-circle',
  error: 'close-circle',
  warning: 'warning',
  info: 'information-circle',
  
  // Music
  music: 'musical-notes',
  musicNote: 'musical-note',
  
  // Platforms
  spotify: 'logo-spotify',       // Custom or use text
  appleLogo: 'logo-apple',
  youtube: 'logo-youtube',
  instagram: 'logo-instagram',
  tiktok: 'logo-tiktok',
  
  // Misc
  star: 'star',
  starOutline: 'star-outline',
  link: 'link',
  time: 'time-outline',
};
```

---

## Motion & Animation

### Principles

1. **Fast** - Animations should feel instant (200-300ms max)
2. **Purposeful** - Only animate to guide attention or provide feedback
3. **Natural** - Use spring physics for organic feel

### Timing

```typescript
const timing = {
  instant: 100,    // Micro-interactions (button press)
  fast: 200,       // Quick transitions
  normal: 300,     // Standard transitions
  slow: 500,       // Deliberate animations (page transitions)
};
```

### Easing

```typescript
import { Easing } from 'react-native-reanimated';

const easing = {
  // For enter animations
  out: Easing.out(Easing.cubic),
  
  // For exit animations
  in: Easing.in(Easing.cubic),
  
  // For continuous animations
  inOut: Easing.inOut(Easing.cubic),
};
```

### Spring Configs

```typescript
const springs = {
  // Bouncy - for playful elements
  bouncy: {
    damping: 10,
    stiffness: 100,
  },
  
  // Snappy - for UI elements
  snappy: {
    damping: 15,
    stiffness: 150,
  },
  
  // Gentle - for large elements
  gentle: {
    damping: 20,
    stiffness: 100,
  },
};
```

### Key Animations

#### Share Received
```typescript
// Quick pulse + checkmark
const scale = useSharedValue(1);
scale.value = withSequence(
  withTiming(1.1, { duration: 100 }),
  withTiming(1, { duration: 100 })
);
```

#### Processing Progress
```typescript
// Smooth width animation
const progress = useSharedValue(0);
progress.value = withTiming(newProgress, { duration: 300 });
```

#### Song Found
```typescript
// Scale up with glow
const scale = useSharedValue(0.8);
const opacity = useSharedValue(0);

scale.value = withSpring(1, springs.bouncy);
opacity.value = withTiming(1, { duration: 300 });
```

#### Streaming Buttons
```typescript
// Staggered entrance
buttons.forEach((_, index) => {
  const delay = index * 50;
  translateY.value = withDelay(delay, withSpring(0, springs.snappy));
  opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
});
```

---

## Haptics

Use `expo-haptics` for tactile feedback.

```typescript
import * as Haptics from 'expo-haptics';

const haptics = {
  // Light tap - button press, toggle
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  
  // Medium tap - selection change
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  
  // Success - job complete
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  
  // Error - job failed
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  
  // Selection - tab change, picker
  selection: () => Haptics.selectionAsync(),
};
```

### When to Use

| Action | Haptic |
|--------|--------|
| Button press | Light |
| Tab change | Selection |
| Toggle switch | Light |
| Share received | Medium |
| Song found | Success |
| Detection failed | Error |
| Pull to refresh complete | Medium |
| Swipe action | Light |

---

## Accessibility

### Minimum Standards

- All interactive elements have accessible labels
- Touch targets minimum 44x44pt
- Color contrast minimum 4.5:1 for text
- Support Dynamic Type (font scaling)
- Support Reduce Motion preference
- VoiceOver labels for all screens

### Implementation

```typescript
// Accessible button
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Play on Spotify"
  accessibilityRole="button"
  accessibilityHint="Opens Spotify to play this song"
>
  ...
</TouchableOpacity>

// Accessible image
<Image
  accessible={true}
  accessibilityLabel={`Album artwork for ${song.title} by ${song.artist}`}
/>

// Reduce motion
const reduceMotion = useReducedMotion();
const duration = reduceMotion ? 0 : 300;
```

---

## Dark Mode

ClipBeat is dark-mode only for v1. This simplifies development and matches the Instagram/TikTok aesthetic.

Future consideration: Light mode for accessibility/preference.

---

## Design Tokens (Summary)

```typescript
// theme.ts
export const theme = {
  colors: {
    primary: '#FF6B35',
    primaryDark: '#E55A2B',
    bg: '#000000',
    bgElevated: '#111111',
    bgSubtle: '#1A1A1A',
    textPrimary: '#FFFFFF',
    textSecondary: '#888888',
    textMuted: '#666666',
    success: '#4CAF50',
    error: '#FF4444',
    warning: '#FFB020',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '700' },
    h2: { fontSize: 22, fontWeight: '700' },
    body: { fontSize: 15, fontWeight: '400' },
    button: { fontSize: 17, fontWeight: '600' },
    caption: { fontSize: 12, fontWeight: '400' },
  },
};
```

---

## Figma Structure (Recommended)

If creating designs in Figma:

```
ClipBeat Design System
├── 🎨 Foundations
│   ├── Colors
│   ├── Typography
│   ├── Spacing
│   ├── Icons
│   └── Shadows
├── 🧩 Components
│   ├── Buttons
│   ├── Cards
│   ├── Inputs
│   ├── Badges
│   ├── Navigation
│   └── Modals
├── 📱 Screens
│   ├── Onboarding
│   ├── History
│   ├── Job Detail
│   ├── Settings
│   ├── Sign In
│   └── Paywall
└── 🔄 Prototypes
    ├── Happy Path Flow
    └── Error States
```
