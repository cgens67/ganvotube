import { NextRequest, NextResponse } from 'next/server'
import YTMusic from 'ytmusic-api'

const ytmusic = new YTMusic()
let initialized = false

async function ensureInitialized() {
  if (!initialized) {
    await ytmusic.initialize()
    initialized = true
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const { artistId } = await params
  if (!artistId) return NextResponse.json({ error: 'Artist ID required' }, { status: 400 })

  try {
    await ensureInitialized()
    const artistData = await ytmusic.getArtist(artistId)
    
    const formatThumbnail = (thumbnails: any[]) => {
      let url = thumbnails?.[thumbnails.length - 1]?.url || ''
      if (url.includes('=w') || url.includes('-w')) {
        url = url.replace(/([=-]w)\d+([=-]h)\d+.*/, '$11280$2720')
      }
      return url
    }

    const topSongs = (artistData.topSongs ||[]).map((song: any) => ({
      videoId: song.videoId,
      title: song.title || song.name,
      artist: artistData.name,
      artistId: artistId,
      album: song.album?.name || song.album?.title || '',
      duration: song.duration || 0,
      thumbnail: formatThumbnail(song.thumbnails),
    }))

    // YTMusic API occasionally wraps these lists inside `.results` object.
    const albumsList = Array.isArray(artistData.albums) ? artistData.albums : (artistData.albums?.results ||[])
    const singlesList = Array.isArray(artistData.singles) ? artistData.singles : (artistData.singles?.results ||[])

    const albums = albumsList.map((album: any) => ({
      albumId: album.browseId || album.albumId || album.id,
      title: album.title || album.name,
      year: album.year,
      thumbnail: formatThumbnail(album.thumbnails)
    }))

    const singles = singlesList.map((single: any) => ({
      albumId: single.browseId || single.albumId || single.id,
      title: single.title || single.name,
      year: single.year,
      thumbnail: formatThumbnail(single.thumbnails)
    }))

    return NextResponse.json({ 
      name: artistData.name,
      description: artistData.description,
      subscribers: artistData.subscribers,
      thumbnails: artistData.thumbnails,
      topSongs,
      albums,
      singles
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch artist' }, { status: 500 })
  }
}
