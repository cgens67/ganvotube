import { NextRequest, NextResponse } from 'next/server'

// Wide coverage. Free servers fail easily due to load + Youtube blocking scripts.
const PIPED_INSTANCES =[
  'https://pipedapi.kavin.rocks',
  'https://api.piped.yt',
  'https://pipedapi.owo.si',
  'https://pipedapi.drgns.space',
  'https://pipedapi.reallyaweso.me',
  'https://piped-api.codespace.cz'
]

async function tryCobaltAPI(videoId: string): Promise<{ audioUrl: string; duration: number; instance: string } | null> {
  // Use public unauthenticated highly resilient Cobalt server for extraction!
  try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch("https://co.wuk.sh/api/json", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ 
              url: `https://www.youtube.com/watch?v=${videoId}`, 
              isAudioOnly: true,
              aFormat: "best",
              isNoTTWatermark: true 
          }),
          signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
          const data = await response.json();
          if (data && data.url) {
              return { audioUrl: data.url, duration: 0, instance: "Cobalt Extraction" }
          }
      }
  } catch (err) {}
  
  return null;
}

async function tryPipedStream(videoId: string, instance: string): Promise<{ audioUrl: string; duration: number; instance: string } | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6500) // Shorter piped attempt allowing multiple cycles
    
    const response = await fetch(`${instance}/streams/${videoId}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
      },
    })
    clearTimeout(timeoutId)
    if (!response.ok) return null

    const data = await response.json()
    const audioStreams = (data.audioStreams ||[])
      .filter((stream: any) => stream.url && stream.mimeType?.includes('audio'))
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))

    if (audioStreams.length > 0) {
      return { audioUrl: audioStreams[0].url, duration: data.duration || 0, instance }
    }
    return null
  } catch { return null }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params
  if (!videoId) return NextResponse.json({ error: 'Video ID is required' }, { status: 400 })

  // Parallel executing multiple requests allowing the backend resolution a much higher immediate success threshold:
  const tasks = PIPED_INSTANCES.map(instance => tryPipedStream(videoId, instance));
  tasks.push(tryCobaltAPI(videoId)); 

  const results = await Promise.allSettled(tasks)

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.audioUrl) {
      return NextResponse.json(result.value, { headers: { 'Cache-Control': 'no-store' } })
    }
  }

  return NextResponse.json(
    { error: 'Could not find audio stream. Service currently blocked by streaming server.' },
    { status: 404 }
  )
}
