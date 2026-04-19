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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    await ensureInitialized()
    const results = await ytmusic.searchSongs(query)
    
    const songs = results.slice(0, 20).map((song) => {
      // Grab the best available thumbnail
      let thumbUrl = song.thumbnails?.[song.thumbnails.length - 1]?.url || ''
      
      // Force YouTube's image server to return the absolute maximum quality (1200x1200px)
      if (thumbUrl.includes('=w') || thumbUrl.includes('-w')) {
        thumbUrl = thumbUrl.replace(/([=-]w)\d+([=-]h)\d+/, '$11200$21200')
      }

      return {
        videoId: song.videoId,
        title: song.name,
        artist: song.artist?.name || 'Unknown Artist',
        album: song.album?.name || '',
        duration: song.duration || 0,
        thumbnail: thumbUrl,
      }
    })

    return NextResponse.json({ results: songs })
  } catch (error) {
    console.error('YouTube Music search error:', error)
    return NextResponse.json({ error: 'Failed to search songs' }, { status: 500 })
  }
}
