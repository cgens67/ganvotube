import { NextResponse } from 'next/server'
import ytSearch from 'yt-search'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Fetch generic YouTube content
    const [trending, gaming, channels] = await Promise.all([
      ytSearch('trending videos'),
      ytSearch('popular gaming videos'),
      ytSearch('popular youtubers')
    ])

    const mapVideo = (v: any) => ({
      videoId: v.videoId,
      title: v.title,
      artist: v.author?.name || 'YouTube',
      album: '',
      duration: v.seconds || 0,
      thumbnail: v.thumbnail || v.image || "/placeholder.svg"
    })

    const accountList = channels.accounts || channels.channels ||[]

    return NextResponse.json({ 
      creatorsPicks: (trending.videos ||[]).slice(0, 15).map(mapVideo), 
      songs: (gaming.videos ||[]).slice(0, 15).map(mapVideo), 
      artists: accountList.slice(0, 15).map((c: any) => ({
         artistId: c.url,
         name: c.name,
         subscribers: c.subCountLabel || 'Channel',
         thumbnail: c.image || c.thumbnail || "/placeholder.svg"
      })), 
      albums:[] 
    })
  } catch (error) {
    console.error('Explore fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch explore data' }, { status: 500 })
  }
}
