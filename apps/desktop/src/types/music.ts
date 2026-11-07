export interface TrackItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationSec: number;
  coverUrl: string;
  explicit?: boolean;
  artistsList?: string[];
  artistId?: string;
  artistBio?: string;
  artistListeners?: string;
  artistCoverUrl?: string;
  albumId?: string;
  year?: string;
  artists?: Array<{ id?: string; name: string }>;
  localFilePath?: string;
  downloadedAt?: number;
}

export interface RealArtistDetails {
  id: string;
  name: string;
  avatarUrl: string;
  bannerUrl: string;
  subscribers?: string;
  views?: string;
  bio?: string;
  topTracks: TrackItem[];
  albums: MediaShelfItem[];
  singles: MediaShelfItem[];
}

export interface RadioStationItem {
  id: string;
  title: string;
  subtitle: string;
  bannerColor: string;
  avatars: string[];
  tag?: string;
}

export interface MediaShelfItem {
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  type: 'album' | 'playlist' | 'artist' | 'single' | 'station';
  trackCount?: number;
  year?: string;
}

export interface YTMSection {
  id: string;
  title: string;
  strapline?: string;
  items: MediaShelfItem[];
}
