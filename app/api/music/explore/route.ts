import { NextResponse } from 'next/server'
import YTMusic from 'ytmusic-api'

const ytmusic = new YTMusic()
let initialized = false

async function ensureInitialized() {
  if (!initialized) {
    await ytmusic.initialize()
    initialized = true
  }
}

export async function GET() {
  try {
    await ensureInitialized()
    
    // Fetch multiple genres concurrently for a rich Explore page
    const [pop, rap, rnb, rock] = await Promise.all([
      ytmusic.searchArtists("Pop Artists"),
      ytmusic.searchArtists("Hip Hop Artists"),
      ytmusic.searchArtists("R&B Artists"),
      ytmusic.searchArtists("Rock Artists")
    ])
    
    // Combine and deduplicate
    const combined = [...pop, ...rap, ...rnb, ...rock]
    const uniqueArtists = Array.from(new Map(combined.map(item => [item.artistId, item])).values())
    
    const artists = uniqueArtists.slice(0, 30).map((artist) => {
      let thumbUrl = artist.thumbnails?.[artist.thumbnails.length - 1]?.url || ''
      // Force high-res images with perfect square crop (-c)
      if (thumbUrl.includes('=w') || thumbUrl.includes('-w')) {
        thumbUrl = thumbUrl.replace(/([=-]w)\d+([=-]h)\d+.*/, '$1800$2800-c')
      }
      return {
        artistId: artist.artistId,
        name: artist.name,
        subscribers: artist.subscribers || 'Popular',
        thumbnail: thumbUrl
      }
    })

    return NextResponse.json({ artists })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch artists' }, { status: 500 })
  }
}
