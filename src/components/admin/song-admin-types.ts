export interface MRLink {
  url: string
  skipSeconds?: number
  label?: string
  duration?: string
}

export interface AdminSong {
  id: string
  title: string
  artist: string
  originalTitle: string
  originalArtist: string
  language: string
  tags?: string[]
  mrLinks?: MRLink[]
  hasLyrics: boolean
  lyrics?: string
  sungCount: number
  likedCount: number
  addedDate: string
  status: 'complete' | 'missing-mr' | 'missing-lyrics' | 'incomplete'
  keyAdjustment?: number | null
  selectedMRIndex?: number
  personalNotes?: string
  imageUrl?: string
  source?: string
}
