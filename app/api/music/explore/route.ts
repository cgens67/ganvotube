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
    const [artistsRes, songsRes, albumsRes] = await Promise.all([
      ytmusic.searchArtists("Top Global Artists"),
      ytmusic.searchSongs("Top Global Hits"),
      ytmusic.searchAlbums("Top Albums 2024")
    ])
    
    // Hardcoded Creator's Picks for maximum speed and reliability
    const creatorsPicks =[
      { videoId: 'M_DiTjNBiOY', title: 'XO Tour Llif3', artist: 'Lil Uzi Vert', thumbnail: 'https://i.ytimg.com/vi/M_DiTjNBiOY/mqdefault.jpg', duration: 182 },
      { videoId: 'nmbiBVPe5bY', title: 'APT.', artist: 'ROSÉ & Bruno Mars', thumbnail: 'https://i.ytimg.com/vi/nmbiBVPe5bY/mqdefault.jpg', duration: 170 },
      { videoId: 'p9OtySpRRL8', title: 'Die With A Smile', artist: 'Lady Gaga, Bruno Mars', thumbnail: 'https://i.ytimg.com/vi/p9OtySpRRL8/mqdefault.jpg', duration: 251 },
      { videoId: 'iHsObIWkM-s', title: 'Heartless', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/iHsObIWkM-s/mqdefault.jpg', duration: 201 },
      { videoId: '_2qJy5r-WAY', title: 'Starboy', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/_2qJy5r-WAY/mqdefault.jpg', duration: 230 },
      { videoId: 'M2dgm4xK3IY', title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/M2dgm4xK3IY/mqdefault.jpg', duration: 200 },
      { videoId: 'DntZ3-yCaFs', title: 'Save Your Tears', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/DntZ3-yCaFs/mqdefault.jpg', duration: 215 },
      { videoId: '-KrC-gqKTMg', title: 'Die For You', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/-KrC-gqKTMg/mqdefault.jpg', duration: 200 }
    ];
    
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
