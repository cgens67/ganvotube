import { NextRequest, NextResponse } from 'next/server'
import ytSearch from 'yt-search'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
  }

  try {
    // Queries the generic YouTube database
    const results = await ytSearch(query)
    
    const videos = results.videos.slice(0, 20).map((v) => ({
      videoId: v.videoId,
      title: v.title,
      artist: v.author?.name || 'YouTube',
      artistId: v.author?.url || null,
      album: '',
      duration: v.seconds || 0,
      thumbnail: v.thumbnail || v.image,
    }))

    return NextResponse.json({ results: videos })
  } catch (error) {
    console.error('YouTube search error:', error)
    return NextResponse.json({ error: 'Failed to search videos' }, { status: 500 })
  }
}
