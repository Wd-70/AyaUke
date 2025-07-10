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

This is a Next.js 14 application using the App Router for a K-pop VTuber fansite. The application has two main sections:

1. **Main Site** (/) - Landing page with hero section, about content, and recent videos
2. **Songbook** (/songbook) - Dynamic song catalog with search and filtering capabilities

### Key Architecture Patterns

- **Hybrid Data Integration**: Combines Google Sheets API (primary song data) with MongoDB (detailed metadata)
- **Client-Side Theme Management**: Theme switching with localStorage persistence and system preference detection
- **API Route Handlers**: Server-side data fetching in `/src/app/api/`
- **Component-Based UI**: Modular components in `/src/components/`
- **Custom Hooks**: Reusable logic in `/src/hooks/`

### Data Flow

1. **Song Data**: Google Sheets → API route → MongoDB enrichment → Client components
2. **Theme Management**: ThemeContext → localStorage → Tailwind CSS classes
3. **Stream Status**: External API → useStreamStatus hook → LiveIndicator component

## Core Technologies

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom color palette
- **Database**: MongoDB with Mongoose ODM
- **External APIs**: Google Sheets API
- **Animation**: Framer Motion
- **Icons**: Heroicons + Lucide React

## Environment Variables

Required environment variables in `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_SHEETS_API_KEY=your_api_key_here
MONGODB_URI=mongodb://your_mongodb_connection_string
```

## Key Implementation Details

### Google Sheets Integration
- Sheet ID is hardcoded in `src/lib/googleSheets.ts:3`
- Auto-detects column headers in multiple languages (Korean/English)
- Fallback parsing when headers aren't found
- Error handling for missing API keys, invalid sheets, etc.

### MongoDB Schema
- Song details stored in `SongDetail` model with extended metadata
- Includes lyrics, aliases, MR links, personal notes, and usage statistics
- Data merged with Google Sheets using normalized title matching

### Theme System
- Dual color palettes (light/dark) defined in Tailwind config
- Server-side theme script prevents flash of unstyled content
- Persistent theme selection with system preference fallback

### Component Structure
- `Navigation`: Responsive nav with theme toggle
- `HeroSection`: Main landing content with live status
- `SongSearch`: Advanced search with filters and sorting
- `SongCard`: Individual song display with metadata

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