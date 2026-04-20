import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const INVIDIOUS_INSTANCES =[
  'https://inv.tux.pizza',
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
  'https://invidious.nerdvpn.de',
  'https://inv.nixnet.services',
  'https://vid.puffyan.us',
  'https://invidious.perennialte.ch'
]

const PIPED_INSTANCES =[
  'https://pipedapi.kavin.rocks',
  'https://api.piped.yt',
  'https://pipedapi.smnz.de',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.moomoo.me'
]

const COBALT_INSTANCES =[
  'https://co.wuk.sh',
  'https://cobalt-api.kwiatek.dev',
  'https://api.cobalt.tools'
]

async function tryCobalt(videoId: string, instance: string) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(instance, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        downloadMode: 'audio',
        isAudioOnly: true,
        aFormat: 'mp3'
      }),
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    if (res.ok) {
      const data = await res.json()
      if (data.url) return { audioUrl: data.url, duration: 0, source: 'cobalt' }
    }
  } catch { return null }
}

async function tryInvidious(videoId: string, instance: string) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const data = await res.json()
    if (data.lengthSeconds) {
      return { audioUrl: `${instance}/latest_version?id=${videoId}&itag=140&local=true`, duration: data.lengthSeconds, source: 'invidious-proxy' }
    }
  } catch { return null }
}

async function tryPiped(videoId: string, instance: string) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${instance}/streams/${videoId}`, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const data = await res.json()
    const audioStreams = (data.audioStreams ||[])
      .filter((s: any) => s.url && s.mimeType?.includes('audio'))
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0)) 

    if (audioStreams.length > 0) {
      return { audioUrl: audioStreams[0].url, duration: data.duration || 0, source: 'piped' }
    }
  } catch { return null }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })
  }

  const promises =[
    ...COBALT_INSTANCES.map(i => tryCobalt(videoId, i)),
    ...INVIDIOUS_INSTANCES.map(i => tryInvidious(videoId, i)),
    ...PIPED_INSTANCES.map(i => tryPiped(videoId, i))
  ]

  try {
    const result = await Promise.any(promises.map(async p => {
      const res = await p
      if (res && res.audioUrl) return res
      throw new Error('Not found')
    }))
    if (result) return NextResponse.json(result)
  } catch (e) {}

  return NextResponse.json(
    { error: 'Could not find audio stream. This song may be region-restricted or unavailable.' },
    { status: 404 }
  )
}
