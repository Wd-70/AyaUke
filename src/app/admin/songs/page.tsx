import { redirect } from 'next/navigation';

/** Preserve old bookmarks; all song management now lives inside the shared admin shell. */
export default function SongsAdminPage() {
  redirect('/admin?tab=songs');
}
