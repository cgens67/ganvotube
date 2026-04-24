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
    url = url.replace(/([=-]w)\d+([=-]h)\d+.*/, '$11280$2720')
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
    
    // Dynamically search for Creator's Picks to ensure 100% correct metadata & audio availability
    const searchQueries =[
      'XO Tour Llif3 Lil Uzi Vert',
      'APT. Rose Bruno Mars',
      'Die With A Smile Lady Gaga Bruno Mars',
      'Heartless The Weeknd',
      'Starboy The Weeknd',
      'Blinding Lights The Weeknd',
      'Save Your Tears The Weeknd',
      'Die For You The Weeknd'
    ];

    const picksResults = await Promise.all(searchQueries.map(async q => {
       try {
         const res = await ytmusic.searchSongs(q);
         return res[0]; // Take the most accurate song result
       } catch(e) { return null; }
    }));

    const creatorsPicks = picksResults.filter(Boolean).map(s => ({
      videoId: s.videoId,
      title: s.name,
      artist: s.artist?.name || 'Unknown Artist',
      album: s.album?.name || '',
      duration: s.duration || 0,
      thumbnail: formatThumb(s.thumbnails)
    }));
    
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
