import { NextRequest, NextResponse } from 'next/server'
import YTMusic from 'ytmusic-api'

export const dynamic = 'force-dynamic'

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
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params
  if (!albumId) return NextResponse.json({ error: 'Album ID required' }, { status: 400 })

  try {
    await ensureInitialized()
    const albumData = await ytmusic.getAlbum(albumId)
    
    const formatThumbnail = (thumbnails: any[]) => {
      let url = thumbnails?.[thumbnails.length - 1]?.url || ''
      if (url.includes('=w') || url.includes('-w')) {
        url = url.replace(/([=-]w)\d+([=-]h)\d+.*/, '$11200$21200-c')
      }
      return url
    }

    const songs = (albumData.songs ||[]).map((song) => ({
      videoId: song.videoId,
      title: song.name,
      artist: song.artist?.name || albumData.artist?.name || 'Unknown Artist',
      album: albumData.name || '',
      duration: song.duration || 0,
      thumbnail: formatThumbnail(albumData.thumbnails),
    }))

    return NextResponse.json({ 
      name: albumData.name,
      artist: albumData.artist?.name,
      year: albumData.year,
      thumbnail: formatThumbnail(albumData.thumbnails),
      songs
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch album' }, { status: 500 })
  }
}
