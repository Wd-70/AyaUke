import { SongDetail, MRLink } from '@/types';

const API_BASE_URL = '/api/song-details';

export const songDetailApi = {
  async getSongDetail(title: string): Promise<SongDetail | null> {
    try {
      const response = await fetch(`${API_BASE_URL}?title=${encodeURIComponent(title)}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching song detail:', error);
      throw error;
    }
  },

  async getAllSongDetails(): Promise<SongDetail[]> {
    try {
      const response = await fetch(API_BASE_URL);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching all song details:', error);
      throw error;
    }
  },

  async createSongDetail(songDetail: Omit<SongDetail, 'createdAt' | 'updatedAt'>): Promise<SongDetail> {
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(songDetail),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating song detail:', error);
      throw error;
    }
  },

  async updateSongDetail(songDetail: Partial<SongDetail> & { title: string }): Promise<SongDetail> {
    try {
      const response = await fetch(API_BASE_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(songDetail),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error updating song detail:', error);
      throw error;
    }
  },

  async deleteSongDetail(title: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}?title=${encodeURIComponent(title)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting song detail:', error);
      throw error;
    }
  },

  async incrementSungCount(title: string): Promise<SongDetail> {
    try {
      const existingDetail = await this.getSongDetail(title);
      const sungCount = (existingDetail?.sungCount || 0) + 1;
      const today = new Date().toISOString().split('T')[0];
      
      return await this.updateSongDetail({
        title,
        sungCount,
        lastSungDate: today,
      });
    } catch (error) {
      console.error('Error incrementing sung count:', error);
      throw error;
    }
  },

  async toggleFavorite(title: string): Promise<SongDetail> {
    try {
      const existingDetail = await this.getSongDetail(title);
      const isFavorite = !(existingDetail?.isFavorite || false);
      
      return await this.updateSongDetail({
        title,
        isFavorite,
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  },

  async addToPlaylist(title: string, playlistName: string): Promise<SongDetail> {
    try {
      const existingDetail = await this.getSongDetail(title);
      const currentPlaylists = existingDetail?.playlists || [];
      
      if (!currentPlaylists.includes(playlistName)) {
        const playlists = [...currentPlaylists, playlistName];
        return await this.updateSongDetail({
          title,
          playlists,
        });
      }
      
      return existingDetail!;
    } catch (error) {
      console.error('Error adding to playlist:', error);
      throw error;
    }
  },

  async removeFromPlaylist(title: string, playlistName: string): Promise<SongDetail> {
    try {
      const existingDetail = await this.getSongDetail(title);
      const currentPlaylists = existingDetail?.playlists || [];
      const playlists = currentPlaylists.filter(p => p !== playlistName);
      
      return await this.updateSongDetail({
        title,
        playlists,
      });
    } catch (error) {
      console.error('Error removing from playlist:', error);
      throw error;
    }
  },

  async getSongsByPlaylist(playlistName: string): Promise<SongDetail[]> {
    try {
      const response = await fetch(`${API_BASE_URL}?playlist=${encodeURIComponent(playlistName)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching songs by playlist:', error);
      throw error;
    }
  },

  async getFavoriteSongs(): Promise<SongDetail[]> {
    try {
      const response = await fetch(`${API_BASE_URL}?favorites=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching favorite songs:', error);
      throw error;
    }
  },

  async selectMR(title: string, mrIndex: number): Promise<SongDetail> {
    try {
      const existingDetail = await this.getSongDetail(title);
      const mrLinks = existingDetail?.mrLinks || [];
      
      if (mrIndex < 0 || mrIndex >= mrLinks.length) {
        throw new Error(`Invalid MR index: ${mrIndex}. Available indices: 0-${mrLinks.length - 1}`);
      }
      
      return await this.updateSongDetail({
        title,
        selectedMRIndex: mrIndex,
      });
    } catch (error) {
      console.error('Error selecting MR:', error);
      throw error;
    }
  },

  getSelectedMR(songDetail: SongDetail): MRLink | null {
    if (!songDetail.mrLinks || songDetail.mrLinks.length === 0) {
      return null;
    }
    
    const index = songDetail.selectedMRIndex || 0;
    return songDetail.mrLinks[index] || songDetail.mrLinks[0];
  }
};