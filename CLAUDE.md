# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server (with increased memory allocation)
npm run dev

# Production build
npm run build

# Production server
npm start

# Lint check
npm run lint

# Install dependencies
npm install
```

## Architecture Overview

This is a Next.js 15.3.4 application using the App Router for a K-pop VTuber fansite (**아야 AyaUke**). The application has two main sections:

1. **Main Site** (/) - Landing page with hero section, live stream status, and recent videos
2. **Songbook** (/songbook) - Dynamic song catalog with advanced search, filtering, and playlist management

### Key Architecture Patterns

- **Hybrid Data Integration**: Combines Google Sheets API (primary song data) with MongoDB (detailed metadata and user data)
- **Authentication System**: NextAuth with custom Chzzk (Korean streaming platform) cookie-based authentication
- **Client-Side Theme Management**: Theme switching with localStorage persistence and system preference detection
- **API Route Handlers**: Server-side data fetching and user management in `/src/app/api/`
- **Component-Based UI**: Modular components in `/src/components/`
- **Custom Hooks**: Reusable logic in `/src/hooks/`

### Data Flow

1. **Song Data**: Google Sheets → API route → MongoDB enrichment → Client components
2. **User Authentication**: Chzzk cookies → NextAuth → MongoDB user management → Session state
3. **Theme Management**: ThemeContext → localStorage → Tailwind CSS classes
4. **Stream Status**: Chzzk API → useStreamStatus hook → LiveIndicator component
5. **Playlists**: User actions → MongoDB → Real-time UI updates

## Core Technologies

- **Framework**: Next.js 15.3.4 with App Router
- **Authentication**: NextAuth 4.24.11 with custom Chzzk provider
- **Styling**: Tailwind CSS with custom color palette
- **Database**: MongoDB with Mongoose ODM
- **External APIs**: Google Sheets API, Chzzk API, YouTube API
- **Animation**: Framer Motion
- **Icons**: Heroicons + Lucide React
- **Platform Integration**: Chzzk (Korean streaming platform) for authentication and live status

## Environment Variables

Required environment variables in `.env.local`:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/ayauke-page

# Google Sheets API
NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY=your_google_sheets_api_key_here

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here

# Naver OAuth (for Chzzk integration)
NAVER_CLIENT_ID=your_naver_client_id_here
NAVER_CLIENT_SECRET=your_naver_client_secret_here

# Chzzk API (optional - for official API)
CHZZK_CLIENT_ID=your_chzzk_client_id_here
CHZZK_CLIENT_SECRET=your_chzzk_client_secret_here

# YouTube API (optional - for video features)
YOUTUBE_API_KEY=your_youtube_api_key_here
```

## Key Implementation Details

### Authentication System
- **Custom Chzzk Provider**: Cookie-based authentication using Chzzk (Korean streaming platform) cookies
- **NextAuth Integration**: Custom credentials provider in `src/lib/authOptions.ts`
- **Admin System**: Admin channel management with role-based permissions
- **User Management**: Automatic user creation/update in MongoDB with Chzzk profile data
- **Session Management**: JWT-based sessions with Chzzk channel information

### Google Sheets Integration
- Sheet ID is hardcoded in `src/lib/googleSheets.ts:3`
- Auto-detects column headers in multiple languages (Korean/English)
- Fallback parsing when headers aren't found
- Error handling for missing API keys, invalid sheets, etc.

### MongoDB Schema
- **SongDetail Model**: Song metadata with lyrics, aliases, MR links, personal notes, and usage statistics
- **User Model**: Chzzk user profiles with channel information and admin roles
- **Playlist System**: User-specific playlists with sharing capabilities via share IDs
- **Like System**: Song likes tied to user accounts
- Data merged between Google Sheets and MongoDB using normalized title matching

### Theme System
- Dual color palettes (light/dark) defined in Tailwind config
- Server-side theme script prevents flash of unstyled content
- Persistent theme selection with system preference fallback

### Component Structure
- `Navigation`: Responsive nav with theme toggle and user authentication
- `HeroSection`: Main landing content with live status
- `SongSearch`: Advanced search with filters and sorting
- `SongCard`: Individual song display with metadata and user interactions
- `PlaylistDetailView`: Playlist management with sharing capabilities

### User Features & Playlist System
- **Personal Playlists**: Users can create and manage custom song playlists
- **Playlist Sharing**: Share IDs allow public access to playlists via `/playlist/[shareId]`
- **Like System**: Users can like/unlike songs with persistent storage
- **Admin Features**: Special admin interface at `/admin` for privileged users
- **Chzzk Integration**: Live stream status monitoring and user authentication via Chzzk platform

### Stream Integration
- **Live Status Detection**: Real-time monitoring of Chzzk stream status
- **Browser Notifications**: Optional notifications when streams go live
- **Stream Metadata**: Display of viewer count, stream title, and thumbnails

## Testing and Development

### Local Subdomain Setup
For testing songbook subdomain functionality:

```bash
# Add to /etc/hosts
127.0.0.1 songbook.localhost
```

### Memory Configuration
Development server runs with increased memory allocation due to large dataset processing.

## Common Development Patterns

### API Route Structure
- Use `/src/app/api/` for server-side endpoints
- Implement proper error handling with descriptive messages
- Return structured JSON responses with status codes

### Component Development
- Use TypeScript interfaces from `/src/types/`
- Implement responsive design with Tailwind utilities
- Follow existing gradient and color patterns
- Use Framer Motion for animations

### Data Fetching
- Server components for initial data loading
- Client components for interactive features
- Error boundaries for graceful failure handling

## Deployment Considerations

- Designed for Vercel deployment
- Requires environment variables to be set in deployment platform
- MongoDB connection should use connection pooling
- Google Sheets API key needs proper permissions

## Color Palette

**Light Mode:**
- Primary: `#D1AFE3` (light purple)
- Secondary: `#F9D891` (yellow accent)
- Accent: `#E38BFF` (bright purple)

**Dark Mode:**
- Primary: `#E35874` (pink/red accent)
- Secondary: `#9875BB` (purple)
- Accent: `#E38BFF` (bright purple)