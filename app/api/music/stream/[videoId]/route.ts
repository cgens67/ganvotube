import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PIPED_INSTANCES =[
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.smnz.de',
  'https://api.piped.yt',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.adminforge.de',
  'https://piped-api.garudalinux.org'
]

const INVIDIOUS_INSTANCES =[
  'https://inv.tux.pizza',
  'https://invidious.asir.dev',
  'https://invidious.protokolla.fi',
  'https://vid.puffyan.us'
]

const COBALT_INSTANCES =[
  'https://api.cobalt.tools',
  'https://cobalt.q0.o0o.ooo',
  'https://co.wuk.sh'
]

async function tryCobalt(videoId: string, instance: string) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(instance, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        downloadMode: 'audio'
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

async function tryRyzen(videoId: string) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`https://api.ryzendesu.vip/api/downloader/ytmp3?url=https://youtu.be/${videoId}`, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (res.ok) {
      const data = await res.json()
      if (data.url || data.download_url) return { audioUrl: data.url || data.download_url, duration: 0, source: 'ryzen' }
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

async function tryInvidious(videoId: string, instance: string) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`${instance}/api/v1/videos/${videoId}`, { signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) return null
    const data = await res.json()
    if (data.formatStreams) {
      const audio = data.formatStreams.find((s: any) => s.type.includes('audio/mp4') || s.type.includes('audio/webm'))
      if (audio && audio.url) return { audioUrl: audio.url, duration: data.lengthSeconds || 0, source: 'invidious' }
    }
  } catch { return null }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'Video ID required' }, { status: 400 })

  // Launch all requests concurrently to get the fastest available source
  const promises =[
    ...COBALT_INSTANCES.map(i => tryCobalt(videoId, i)),
    tryRyzen(videoId),
    ...PIPED_INSTANCES.map(i => tryPiped(videoId, i)),
    ...INVIDIOUS_INSTANCES.map(i => tryInvidious(videoId, i))
  ]

  try {
    const result = await Promise.any(promises.map(async p => {
      const res = await p
      if (res && res.audioUrl) return res
      throw new Error('Not found')
    }))
    if (result) return NextResponse.json(result)
  } catch (e) {}

  return NextResponse.json({ error: 'Could not find audio stream. The song may be unavailable or region-restricted.' }, { status: 404 })
}
