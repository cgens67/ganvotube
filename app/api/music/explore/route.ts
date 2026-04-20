import { NextResponse } from 'next/server'
import YTMusic from 'ytmusic-api'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const ytmusic = new YTMusic()
let initialized = false

async function ensureInitialized() {
  if (!initialized) {
    await ytmusic.initialize()
    initialized = true
  }
}

const formatThumb = (thumbnails: any[]) => {
  let url = thumbnails?.[thumbnails.length - 1]?.url || ''
  if (url.includes('=w') || url.includes('-w')) {
    url = url.replace(/([=-]w)\d+([=-]h)\d+.*/, '$11200$21200-c')
  }
  return url
}

export async function GET() {
  try {
    await ensureInitialized()
    
    // Fetch categories concurrently
    const[artistsRes, songsRes, albumsRes] = await Promise.all([
      ytmusic.searchArtists("Top Global Artists"),
      ytmusic.searchSongs("Top Global Hits"),
      ytmusic.searchAlbums("Top Albums 2024")
    ])
    
    // Fetch Creator's Picks with a safe fallback loop so they always appear
    const picksIds =['M_DiTjNBiOY', 'nmbiBVPe5bY', 'p9OtySpRRL8', 'iHsObIWkM-s', '_2qJy5r-WAY', 'M2dgm4xK3IY', 'DntZ3-yCaFs', '-KrC-gqKTMg']
    const creatorsPicks =[];
    
    for (const id of picksIds) {
      try {
        const song = await ytmusic.getSong(id);
        if (song) {
          creatorsPicks.push({
            videoId: song.videoId || id,
            title: song.name || 'Unknown Track',
            artist: song.artist?.name || 'Unknown Artist',
            album: song.album?.name || '',
            duration: song.duration || 0,
            thumbnail: formatThumb(song.thumbnails) || `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
          });
        }
      } catch (e) {
        // Fallback if ytmusic-api fails for a specific region-restricted ID
        creatorsPicks.push({
          videoId: id,
          title: 'YouTube Track',
          artist: 'Unknown Artist',
          album: '',
          duration: 0,
          thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
        });
      }
    }
    
    const artists = artistsRes.slice(0, 15).map(a => ({
      artistId: a.artistId,
      name: a.name,
      subscribers: a.subscribers || 'Popular',
      thumbnail: formatThumb(a.thumbnails)
    }))

    const songs = songsRes.slice(0, 15).map(s => ({
      videoId: s.videoId,
      title: s.name,
      artist: s.artist?.name || 'Unknown Artist',
      artistId: s.artist?.artistId || null,
      album: s.album?.name || '',
      duration: s.duration || 0,
      thumbnail: formatThumb(s.thumbnails)
    }))

    const albums = albumsRes.slice(0, 15).map(a => ({
      albumId: a.albumId || a.id,
      title: a.name,
      artist: a.artist?.name || 'Unknown Artist',
      year: a.year || '',
      thumbnail: formatThumb(a.thumbnails)
    }))

    return NextResponse.json({ creatorsPicks, artists, songs, albums })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch explore data' }, { status: 500 })
  }
}
