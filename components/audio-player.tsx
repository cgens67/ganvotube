"use client"

import * as React from "react"
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Volume1,
  Shuffle, 
  Repeat, 
  Repeat1,
  Heart,
  MoreHorizontal,
  Music2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Track {
  id: number
  title: string
  artist: string
  album: string
  duration: number
  cover: string
  audioUrl: string
  liked?: boolean
}

// Free royalty-free music samples from Pixabay
const sampleTracks: Track[] = [
  { 
    id: 1, 
    title: "Chill Abstract", 
    artist: "Coma-Media", 
    album: "Ambient Dreams", 
    duration: 118, 
    cover: "https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    liked: true
  },
  { 
    id: 2, 
    title: "Lofi Study", 
    artist: "FASSounds", 
    album: "Focus Flow", 
    duration: 147, 
    cover: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946db8a98e.mp3"
  },
  { 
    id: 3, 
    title: "Good Night", 
    artist: "FASSounds", 
    album: "Evening Calm", 
    duration: 146, 
    cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bab.mp3"
  },
  { 
    id: 4, 
    title: "Cinematic Ambient", 
    artist: "Lexin Music", 
    album: "Film Scores", 
    duration: 180, 
    cover: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/08/02/audio_884fe92c21.mp3",
    liked: true
  },
  { 
    id: 5, 
    title: "Ambient Piano", 
    artist: "Daddy_s_Music", 
    album: "Piano Dreams", 
    duration: 192, 
    cover: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749d484.mp3"
  },
  { 
    id: 6, 
    title: "Electronic Future", 
    artist: "QubeSounds", 
    album: "Digital Age", 
    duration: 148, 
    cover: "https://images.unsplash.com/photo-1635322966219-b75ed372eb01?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2023/09/04/audio_0468996946.mp3"
  },
  { 
    id: 7, 
    title: "Peaceful Garden", 
    artist: "Lesfm", 
    album: "Nature Sounds", 
    duration: 171, 
    cover: "https://images.unsplash.com/photo-1604871000636-074fa5117945?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/08/25/audio_4f3b0a816e.mp3"
  },
  { 
    id: 8, 
    title: "Deep Space", 
    artist: "SergePavkinMusic", 
    album: "Cosmic Journey", 
    duration: 184, 
    cover: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=300&h=300&fit=crop",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/11/22/audio_febc508520.mp3",
    liked: true
  },
]

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function VolumeIcon({ volume, muted }: { volume: number; muted: boolean }) {
  if (muted || volume === 0) return <VolumeX className="size-5" />
  if (volume < 50) return <Volume1 className="size-5" />
  return <Volume2 className="size-5" />
}

function EqualizerBars() {
  return (
    <div className="flex items-end justify-center gap-0.5 h-4">
      <span className="w-1 bg-primary rounded-full animate-equalizer-1" />
      <span className="w-1 bg-primary rounded-full animate-equalizer-2" />
      <span className="w-1 bg-primary rounded-full animate-equalizer-3" />
      <span className="w-1 bg-primary rounded-full animate-equalizer-4" />
    </div>
  )
}

export function AudioPlayer() {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [currentTrackIndex, setCurrentTrackIndex] = React.useState(0)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [volume, setVolume] = React.useState([75])
  const [isMuted, setIsMuted] = React.useState(false)
  const [isShuffled, setIsShuffled] = React.useState(false)
  const [repeatMode, setRepeatMode] = React.useState<"off" | "all" | "one">("off")
  const [tracks, setTracks] = React.useState(sampleTracks)
  const [isLoading, setIsLoading] = React.useState(false)
  
  const currentTrack = tracks[currentTrackIndex]

  // Handle audio events
  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => setDuration(audio.duration || currentTrack.duration)
    const handleEnded = () => handleNext()
    const handleCanPlay = () => setIsLoading(false)
    const handleWaiting = () => setIsLoading(true)
    const handlePlaying = () => setIsLoading(false)

    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("durationchange", handleDurationChange)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("canplay", handleCanPlay)
    audio.addEventListener("waiting", handleWaiting)
    audio.addEventListener("playing", handlePlaying)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("durationchange", handleDurationChange)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("canplay", handleCanPlay)
      audio.removeEventListener("waiting", handleWaiting)
      audio.removeEventListener("playing", handlePlaying)
    }
  }, [currentTrackIndex])

  // Handle play/pause
  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying])

  // Handle volume changes
  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isMuted ? 0 : volume[0] / 100
  }, [volume, isMuted])

  // Handle track changes
  React.useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    setCurrentTime(0)
    audio.load()
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    }
  }, [currentTrackIndex])

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handlePrevious = () => {
    if (currentTime > 3) {
      const audio = audioRef.current
      if (audio) audio.currentTime = 0
      setCurrentTime(0)
    } else {
      setCurrentTrackIndex((prev) => (prev === 0 ? tracks.length - 1 : prev - 1))
    }
  }

  const handleNext = () => {
    if (repeatMode === "one") {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = 0
        audio.play()
      }
      return
    }

    if (isShuffled) {
      const randomIndex = Math.floor(Math.random() * tracks.length)
      setCurrentTrackIndex(randomIndex)
    } else if (currentTrackIndex === tracks.length - 1) {
      if (repeatMode === "all") {
        setCurrentTrackIndex(0)
      } else {
        setIsPlaying(false)
      }
    } else {
      setCurrentTrackIndex((prev) => prev + 1)
    }
  }

  const handleProgressChange = (value: number[]) => {
    const audio = audioRef.current
    if (!audio) return
    const newTime = (value[0] / 100) * (duration || currentTrack.duration)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value)
    setIsMuted(value[0] === 0)
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all"
      if (prev === "all") return "one"
      return "off"
    })
  }

  const handleTrackSelect = (index: number) => {
    setCurrentTrackIndex(index)
    setIsPlaying(true)
  }

  const toggleLike = (trackId: number) => {
    setTracks(prev => 
      prev.map(track => 
        track.id === trackId ? { ...track, liked: !track.liked } : track
      )
    )
  }

  const progressPercent = (currentTime / (duration || currentTrack.duration)) * 100

  return (
    <div className="flex h-screen w-full flex-col bg-background lg:flex-row overflow-hidden">
      {/* Hidden Audio Element */}
      <audio ref={audioRef} src={currentTrack.audioUrl} preload="metadata" />

      {/* Main Player Area */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 lg:p-12 relative overflow-hidden">
        {/* Background Gradient Effect */}
        <div 
          className="absolute inset-0 opacity-30 blur-3xl transition-all duration-1000"
          style={{
            background: `radial-gradient(circle at 50% 30%, var(--primary) 0%, transparent 50%)`
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center w-full max-w-lg">
          {/* Album Art Container with M3 Expressive styling */}
          <div className="relative mb-8 w-full max-w-sm">
            {/* Vinyl Record Effect */}
            <div className={cn(
              "absolute inset-4 rounded-full bg-surface-container-highest transition-all duration-700",
              isPlaying ? "animate-vinyl-spin" : "animate-vinyl-spin paused"
            )}>
              <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(255,255,255,0.03)_0deg,transparent_60deg,rgba(255,255,255,0.03)_120deg,transparent_180deg,rgba(255,255,255,0.03)_240deg,transparent_300deg)]" />
              <div className="absolute inset-[35%] rounded-full bg-background" />
              <div className="absolute inset-[42%] rounded-full bg-surface-container" />
            </div>

            {/* Album Cover */}
            <div className={cn(
              "relative aspect-square overflow-hidden rounded-3xl shadow-2xl transition-all duration-500",
              isPlaying && "shadow-primary/20 shadow-[0_8px_60px_-15px]"
            )}>
              <img
                src={currentTrack.cover}
                alt={`${currentTrack.album} cover`}
                className={cn(
                  "h-full w-full object-cover transition-transform duration-700",
                  isPlaying && "scale-105"
                )}
                crossOrigin="anonymous"
              />
              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <div className="size-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                </div>
              )}
              {/* Playing Indicator Overlay */}
              {isPlaying && !isLoading && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-background/80 backdrop-blur-sm px-3 py-1.5">
                  <EqualizerBars />
                  <span className="text-xs font-medium text-foreground">Playing</span>
                </div>
              )}
            </div>
          </div>

          {/* Track Info with M3 Typography */}
          <div className="mb-6 text-center w-full">
            <div className="flex items-center justify-center gap-3 mb-2">
              <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
                {currentTrack.title}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleLike(currentTrack.id)}
                className={cn(
                  "size-8 rounded-full transition-all",
                  currentTrack.liked 
                    ? "text-primary hover:text-primary/80" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Heart className={cn("size-5", currentTrack.liked && "fill-current")} />
                <span className="sr-only">{currentTrack.liked ? "Unlike" : "Like"}</span>
              </Button>
            </div>
            <p className="text-base text-muted-foreground font-medium">{currentTrack.artist}</p>
            <p className="text-sm text-on-surface-variant mt-0.5">{currentTrack.album}</p>
          </div>

          {/* Progress Bar - M3 Style */}
          <div className="mb-8 w-full">
            <div className="group relative">
              <Slider
                value={[progressPercent]}
                onValueChange={handleProgressChange}
                max={100}
                step={0.1}
                className="cursor-pointer [&_[data-slot=thumb]]:size-0 [&_[data-slot=thumb]]:opacity-0 group-hover:[&_[data-slot=thumb]]:size-4 group-hover:[&_[data-slot=thumb]]:opacity-100 [&_[data-slot=thumb]]:transition-all [&_[data-slot=thumb]]:shadow-lg [&_[data-slot=range]]:bg-primary [&_[data-slot=track]]:bg-surface-container-highest [&_[data-slot=track]]:h-2 group-hover:[&_[data-slot=track]]:h-3 [&_[data-slot=track]]:transition-all"
              />
            </div>
            <div className="mt-3 flex justify-between text-xs font-medium text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration || currentTrack.duration)}</span>
            </div>
          </div>

          {/* Main Controls - M3 Expressive FAB Style */}
          <div className="mb-8 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsShuffled(!isShuffled)}
              className={cn(
                "size-12 rounded-full transition-all",
                isShuffled 
                  ? "bg-primary/15 text-primary hover:bg-primary/25" 
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-container-high"
              )}
            >
              <Shuffle className="size-5" />
              <span className="sr-only">Shuffle</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="size-14 rounded-full text-foreground hover:bg-surface-container-high transition-all active:scale-95"
            >
              <SkipBack className="size-7 fill-current" />
              <span className="sr-only">Previous track</span>
            </Button>

            <Button
              size="icon"
              onClick={handlePlayPause}
              disabled={isLoading}
              className={cn(
                "size-20 rounded-full shadow-lg transition-all active:scale-95",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "shadow-primary/30 hover:shadow-primary/40 hover:shadow-xl",
                isPlaying && "shadow-primary/50"
              )}
            >
              {isLoading ? (
                <div className="size-8 rounded-full border-3 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              ) : isPlaying ? (
                <Pause className="size-9 fill-current" />
              ) : (
                <Play className="size-9 fill-current ml-1" />
              )}
              <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="size-14 rounded-full text-foreground hover:bg-surface-container-high transition-all active:scale-95"
            >
              <SkipForward className="size-7 fill-current" />
              <span className="sr-only">Next track</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={cycleRepeatMode}
              className={cn(
                "size-12 rounded-full transition-all",
                repeatMode !== "off" 
                  ? "bg-primary/15 text-primary hover:bg-primary/25" 
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-container-high"
              )}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="size-5" />
              ) : (
                <Repeat className="size-5" />
              )}
              <span className="sr-only">Repeat mode: {repeatMode}</span>
            </Button>
          </div>

          {/* Volume Control - M3 Style */}
          <div className="flex w-full max-w-xs items-center gap-3 px-4 py-3 rounded-full bg-surface-container">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="size-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-container-high"
            >
              <VolumeIcon volume={volume[0]} muted={isMuted} />
              <span className="sr-only">{isMuted ? "Unmute" : "Mute"}</span>
            </Button>
            <Slider
              value={isMuted ? [0] : volume}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="flex-1 cursor-pointer [&_[data-slot=thumb]]:size-4 [&_[data-slot=thumb]]:border-2 [&_[data-slot=thumb]]:border-primary [&_[data-slot=thumb]]:bg-foreground [&_[data-slot=range]]:bg-primary [&_[data-slot=track]]:bg-outline-variant"
            />
            <span className="text-xs font-medium text-muted-foreground w-8 text-right">
              {isMuted ? 0 : volume[0]}%
            </span>
          </div>
        </div>
      </div>

      {/* Playlist Panel - M3 Surface Container */}
      <div className="border-t border-border bg-surface-container lg:w-[400px] lg:border-l lg:border-t-0 flex flex-col h-80 lg:h-auto">
        {/* Playlist Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Music2 className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Queue</h3>
              <span className="text-xs text-muted-foreground">
                {tracks.length} tracks
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-container-high"
          >
            <MoreHorizontal className="size-5" />
            <span className="sr-only">More options</span>
          </Button>
        </div>

        {/* Playlist Items */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {tracks.map((track, index) => (
              <button
                key={track.id}
                onClick={() => handleTrackSelect(index)}
                className={cn(
                  "group flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-all",
                  "hover:bg-surface-container-high active:scale-[0.98]",
                  currentTrackIndex === index && "bg-primary/10"
                )}
              >
                {/* Track Thumbnail */}
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                  <img
                    src={track.cover}
                    alt={track.album}
                    className="size-full object-cover"
                    crossOrigin="anonymous"
                  />
                  {currentTrackIndex === index && isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                      <EqualizerBars />
                    </div>
                  )}
                </div>

                {/* Track Info */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-semibold transition-colors",
                      currentTrackIndex === index
                        ? "text-primary"
                        : "text-foreground"
                    )}
                  >
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {track.artist}
                  </p>
                </div>

                {/* Like & Duration */}
                <div className="flex items-center gap-2 shrink-0">
                  {track.liked && (
                    <Heart className="size-4 text-primary fill-primary" />
                  )}
                  <span className="text-xs font-medium text-on-surface-variant tabular-nums">
                    {formatTime(track.duration)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Now Playing Mini Bar (Mobile) */}
        <div className="lg:hidden border-t border-outline-variant p-3 bg-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg overflow-hidden">
              <img 
                src={currentTrack.cover} 
                alt={currentTrack.album}
                className="size-full object-cover"
                crossOrigin="anonymous"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{currentTrack.title}</p>
              <p className="text-xs text-muted-foreground truncate">{currentTrack.artist}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePlayPause}
                className="size-10 rounded-full"
              >
                {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 ml-0.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
