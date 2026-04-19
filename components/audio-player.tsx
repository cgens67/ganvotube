"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { initializeApp, getApps, getApp } from "firebase/app"
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser 
} from "firebase/auth"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Search, Shuffle, Repeat, Repeat1, Sun, Moon, Loader2, Music2,
  X, ListMusic, Mic2, MoreVertical, Info, Heart, ChevronDown,
  ChevronUp, ExternalLink, History, Library, UserCircle2, LogOut,
  Maximize, Minimize, Settings, TrendingUp, ListPlus, Disc3, MicVocal,
  ArrowLeft, Palette, LayoutTemplate, CornerUpRight, MousePointerClick, 
  SlidersHorizontal, Hand, RefreshCw, ChevronRight, AudioLines
} from "lucide-react"
import { cn } from "@/lib/utils"

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBI-ABs1S7Ln2jJ7xYxgUZwU1nEXZmqI2c",
  authDomain: "ganvotesting.firebaseapp.com",
  projectId: "ganvotesting",
  storageBucket: "ganvotesting.firebasestorage.app",
  messagingSenderId: "1083596663051",
  appId: "1:1083596663051:web:52900f44e84034b7421a0e"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = typeof window !== "undefined" ? getAuth(app) : null;
const db = typeof window !== "undefined" ? getFirestore(app) : null;
const googleProvider = typeof window !== "undefined" ? new GoogleAuthProvider() : null;

interface Song {
  videoId: string
  title: string
  artist: string
  artistId?: string | null
  album: string
  duration: number
  thumbnail: string
}

interface Playlist {
  id: string
  name: string
  songs: Song[]
}

interface LyricLine {
  time: number
  text: string
}

interface LyricsData {
  syncedLyrics: LyricLine[] | null
  plainLyrics: string | null
}

export function AudioPlayer() {
  const[isDark, setIsDark] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const[isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [queue, setQueue] = useState<Song[]>([])
  const[currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const[isMuted, setIsMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const[repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off")
  const[isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const[audioUrl, setAudioUrl] = useState<string | null>(null)
  
  // Audio Effects (Tempo & Pitch)
  const[playbackRate, setPlaybackRate] = useState(1)
  const [preservesPitch, setPreservesPitch] = useState(true)
  const [showEffectsDialog, setShowEffectsDialog] = useState(false)

  const[activeTab, setActiveTab] = useState<'queue' | 'lyrics' | 'library' | 'explore' | 'artist'>('explore')
  const [isMobilePlayerExpanded, setIsMobilePlayerExpanded] = useState(false)
  const [mobilePlayerTab, setMobilePlayerTab] = useState<'player' | 'lyrics' | 'queue'>('player')

  const [exploreData, setExploreData] = useState<{artists: any[], songs: Song[], albums: any[]}>({artists: [], songs: [], albums:[]})
  const[isExploreLoading, setIsExploreLoading] = useState(true)
  const [exploreError, setExploreError] = useState(false)
  const [currentArtistData, setCurrentArtistData] = useState<any>(null)
  const[isArtistLoading, setIsArtistLoading] = useState(false)

  const [showAboutDialog, setShowAboutDialog] = useState(false)
  const [showCreditsDialog, setShowCreditsDialog] = useState(false)
  const[showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false)
  const[newPlaylistName, setNewPlaylistName] = useState("")
  
  // Customization Settings
  const [dynamicTheme, setDynamicTheme] = useState(true)
  const [swipeToChange, setSwipeToChange] = useState(true)
  const [rotateLyricsBg, setRotateLyricsBg] = useState(true)
  
  const[showAuthDialog, setShowAuthDialog] = useState(false)
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [authError, setAuthError] = useState("")
  const [displayNameInput, setDisplayNameInput] = useState("")
  
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
  const [savedSongs, setSavedSongs] = useState<Song[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [searchFocused, setSearchFocused] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const lyricsContainerRefMobile = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const currentSong = queue[currentIndex]

  // Apply Audio Effects (Tempo / Pitch)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
      // @ts-ignore - Some browsers support this property directly
      audioRef.current.preservesPitch = preservesPitch
      // @ts-ignore
      audioRef.current.mozPreservesPitch = preservesPitch
      // @ts-ignore
      audioRef.current.webkitPreservesPitch = preservesPitch
    }
  }, [playbackRate, preservesPitch, audioUrl])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error(err))
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => console.error(err))
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  },[])

  useEffect(() => {
    try {
      const history = localStorage.getItem('ganvo_search_history')
      if (history) setSearchHistory(JSON.parse(history))
    } catch (e) {}

    setIsExploreLoading(true)
    setExploreError(false)
    fetch('/api/music/explore')
      .then(res => res.json())
      .then(data => { 
        if (data && !data.error && data.artists && data.songs && data.albums) {
          setExploreData(data) 
        } else {
          setExploreError(true)
        }
      })
      .catch((err) => {
        console.error(err)
        setExploreError(true)
      })
      .finally(() => setIsExploreLoading(false))
  },[])

  useEffect(() => {
    if (!auth || !db) return
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        setDisplayNameInput(currentUser.displayName || "")
        const userRef = doc(db, "users", currentUser.uid)
        const docSnap = await getDoc(userRef)
        if (docSnap.exists()) {
          const data = docSnap.data()
          if (data.savedSongs) {
            setSavedSongs(data.savedSongs)
            setLikedSongs(new Set(data.savedSongs.map((s: Song) => s.videoId)))
          }
          if (data.playlists) setPlaylists(data.playlists)
        } else {
          await setDoc(userRef, { savedSongs: [], playlists:[] })
        }
      } else {
        const saved = localStorage.getItem('ganvo_saved_songs')
        const localPlaylists = localStorage.getItem('ganvo_playlists')
        if (saved) {
          const parsed = JSON.parse(saved)
          setSavedSongs(parsed)
          setLikedSongs(new Set(parsed.map((s: Song) => s.videoId)))
        } else {
          setSavedSongs([])
          setLikedSongs(new Set())
        }
        if (localPlaylists) setPlaylists(JSON.parse(localPlaylists))
        else setPlaylists([])
      }
    })
    return () => unsubscribe()
  },[])

  const syncToCloud = async (newSaved: Song[], newPlaylists: Playlist[]) => {
    // ALWAYS save to local storage as fallback/guarantee
    localStorage.setItem('ganvo_saved_songs', JSON.stringify(newSaved))
    localStorage.setItem('ganvo_playlists', JSON.stringify(newPlaylists))
    
    if (user && db) {
      try {
        const userRef = doc(db, "users", user.uid)
        await setDoc(userRef, { savedSongs: newSaved, playlists: newPlaylists }, { merge: true })
      } catch (e) { console.error("Cloud sync failed", e) }
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    if (!auth) return
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      setShowAuthDialog(false)
      setEmail("")
      setPassword("")
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError("Email/Password login is not enabled in Firebase Console.")
      } else if (error.code === 'auth/invalid-credential') {
        setAuthError("Incorrect email or password.")
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError("An account with this email already exists.")
      } else {
        setAuthError(error.message.replace("Firebase: ", ""))
      }
    }
  }

  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) return
    setAuthError("")
    try {
      await signInWithPopup(auth, googleProvider)
      setShowAuthDialog(false)
    } catch (error: any) {
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError("Google login is not enabled in Firebase Console.")
      } else {
        setAuthError(error.message.replace("Firebase: ", ""))
      }
    }
  }

  const handleSignOut = async () => { if (auth) await signOut(auth) }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (auth?.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: displayNameInput })
        setUser({ ...auth.currentUser }) 
        setShowAccountSettings(false)
      } catch (e) { console.error(e) }
    }
  }

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlaylistName.trim()) return
    const newPlaylist: Playlist = { id: Date.now().toString(), name: newPlaylistName.trim(), songs: [] }
    const updatedPlaylists =[...playlists, newPlaylist]
    setPlaylists(updatedPlaylists)
    syncToCloud(savedSongs, updatedPlaylists)
    setNewPlaylistName("")
    setShowPlaylistDialog(false)
  }

  const addSongToPlaylist = (playlistId: string, song: Song) => {
    const updatedPlaylists = playlists.map(p => {
      if (p.id === playlistId) {
        if (!p.songs.find(s => s.videoId === song.videoId)) {
          return { ...p, songs: [...p.songs, song] }
        }
      }
      return p
    })
    setPlaylists(updatedPlaylists)
    syncToCloud(savedSongs, updatedPlaylists)
  }

  const loadArtistView = async (artistId: string) => {
    setIsArtistLoading(true)
    setActiveTab('artist')
    setCurrentArtistData(null)
    try {
      const res = await fetch(`/api/music/artist/${artistId}`)
      const data = await res.json()
      if (data && !data.error) {
        setCurrentArtistData(data)
      } else {
        setCurrentArtistData(null)
      }
    } catch (e) {
      console.error(e)
      setCurrentArtistData(null)
    } finally {
      setIsArtistLoading(false)
    }
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  },[isDark])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
        setIsSearchExpanded(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  },[])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!searchQuery.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()
        setSearchResults(data.results ||[])
      } catch (error) {
        console.error("Search failed:", error)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery])

  const addToQueueAndPlay = async (song: Song) => {
    const saveSearchStr = searchQuery || song.title
    if (saveSearchStr.trim()) {
      const newHistory =[saveSearchStr, ...searchHistory.filter(q => q !== saveSearchStr)].slice(0, 15)
      setSearchHistory(newHistory)
      localStorage.setItem('ganvo_search_history', JSON.stringify(newHistory))
    }
    
    const existingIndex = queue.findIndex((s) => s.videoId === song.videoId)
    if (existingIndex >= 0) {
      setCurrentIndex(existingIndex)
    } else {
      setQueue((prev) => [...prev, song])
      setCurrentIndex(queue.length)
    }
    setSearchResults([])
    setSearchQuery("")
    setIsSearchExpanded(false)
    setSearchFocused(false)
  }

  const playFromLibrary = (song: Song) => {
    addToQueueAndPlay(song)
  }

  useEffect(() => {
    if (!currentSong) return

    const loadStream = async () => {
      setIsLoading(true)
      setAudioUrl(null)
      setLoadError(null)

      try {
        const response = await fetch(`/api/music/stream/${currentSong.videoId}`)
        const data = await response.json()

        if (data.error) {
          setLoadError(data.error)
          return
        }

        if (data.audioUrl) {
          setAudioUrl(data.audioUrl)
        } else {
          setLoadError("No audio stream available")
        }
      } catch (error) {
        setLoadError("Network error. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    loadStream()
  }, [currentSong?.videoId])

  useEffect(() => {
    if (!currentSong) return

    const loadLyrics = async () => {
      setLyrics(null)
      setCurrentLyricIndex(-1)

      try {
        const params = new URLSearchParams({
          track: currentSong.title,
          artist: currentSong.artist,
          ...(currentSong.album && { album: currentSong.album }),
          ...(currentSong.duration && { duration: String(currentSong.duration) }),
        })
        const response = await fetch(`/api/lyrics?${params}`)
        const data = await response.json()

        if (data.syncedLyrics || data.plainLyrics) {
          setLyrics({ syncedLyrics: data.syncedLyrics, plainLyrics: data.plainLyrics })
        }
      } catch (error) {}
    }

    loadLyrics()
  },[currentSong?.videoId])

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.load()
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        if (err.name === 'AbortError') return;
        setLoadError("Playback failed. Try another song.")
      })
    }
  },[audioUrl])

  useEffect(() => {
    if (!lyrics?.syncedLyrics) return
    const lyric = lyrics.syncedLyrics.findLast((l) => l.time <= currentTime)
    const index = lyric ? lyrics.syncedLyrics.indexOf(lyric) : -1

    if (index !== currentLyricIndex) {
      setCurrentLyricIndex(index)
      if (index >= 0) {
        setTimeout(() => {
          const activeLines = document.querySelectorAll('.lyric-active-line');
          activeLines.forEach((line) => {
            const container = line.closest('.lyrics-scroll-container') as HTMLElement;
            if (container && line instanceof HTMLElement) {
              const scrollPos = line.offsetTop - (container.clientHeight / 2) + (line.clientHeight / 2);
              container.scrollTo({ top: scrollPos, behavior: 'smooth' });
            }
          })
        }, 50)
      }
    }
  },[currentTime, lyrics, currentLyricIndex])

  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime) }
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration) }
  const handleEnded = () => {
    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(e => e.name !== 'AbortError' && console.error(e))
      }
    } else {
      playNext()
    }
  }

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play().catch(e => e.name !== 'AbortError' && console.error(e))
    setIsPlaying(!isPlaying)
  }, [isPlaying, audioUrl])

  const playNext = useCallback(() => {
    if (queue.length === 0) return
    let nextIndex = shuffle ? Math.floor(Math.random() * queue.length) : (currentIndex + 1) % queue.length
    if (nextIndex === 0 && repeatMode === "off" && !shuffle) {
      setIsPlaying(false)
      return
    }
    setCurrentIndex(nextIndex)
  }, [queue.length, currentIndex, shuffle, repeatMode])

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return
    if (currentTime > 3) {
      if (audioRef.current) audioRef.current.currentTime = 0
      return
    }
    setCurrentIndex((currentIndex - 1 + queue.length) % queue.length)
  },[queue.length, currentIndex, currentTime])

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
    if (audioRef.current) audioRef.current.volume = newVolume / 100
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    if (audioRef.current) audioRef.current.volume = isMuted ? volume / 100 : 0
  }

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index))
    if (index < currentIndex) setCurrentIndex((prev) => prev - 1)
    else if (index === currentIndex && queue.length > 1 && index === queue.length - 1) setCurrentIndex((prev) => prev - 1)
  }

  const toggleLike = async (song: Song) => {
    setLikedSongs((prev) => {
      const next = new Set(prev)
      let newSaved = [...savedSongs]
      if (next.has(song.videoId)) {
        next.delete(song.videoId)
        newSaved = newSaved.filter(s => s.videoId !== song.videoId)
      } else {
        next.add(song.videoId)
        newSaved.unshift(song)
      }
      setSavedSongs(newSaved)
      syncToCloud(newSaved, playlists)
      return next
    })
  }

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleRetryStream = async () => {
    if (!currentSong) return;
    setLoadError(null);
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/music/stream/${currentSong.videoId}`);
      const data = await response.json();
      
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        if (audioRef.current) {
          audioRef.current.src = data.audioUrl;
          audioRef.current.load();
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(() => setIsPlaying(true)).catch(e => {
              if (e.name !== 'AbortError') setLoadError("Playback failed. Try another song.");
            });
          }
        }
      } else {
        setLoadError(data.error || "Failed to load stream");
      }
    } catch (e) {
      setLoadError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2
  const showSearchDropdown = searchFocused && (searchResults.length > 0 || isSearching || (searchQuery.trim() === "" && searchHistory.length > 0))

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background transition-colors duration-500 font-sans">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Header - Expressive M3 style */}
      <header className="elevation-1 z-40 flex h-16 flex-shrink-0 items-center justify-between px-3 md:px-6 transition-all duration-500 ease-out relative bg-background/90 backdrop-blur-xl border-b border-border/40 gap-2">
        <div className={cn(
          "flex items-center shrink-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-left overflow-hidden", 
          searchFocused ? "w-0 opacity-0 md:w-auto md:opacity-100 gap-0 md:gap-3" : "w-auto opacity-100 gap-3"
        )}>
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-foreground transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 hover:rotate-3 shadow-md">
            <Music2 className="h-5 w-5 text-background fill-current" />
          </div>
          <div className="hidden sm:flex items-baseline gap-1">
            <span className="text-xl font-normal text-muted-foreground tracking-tight">Ganvo</span>
            <span className="text-xl font-bold tracking-tight text-foreground">Music</span>
          </div>
        </div>

        {/* Search bar */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-2xl mx-auto w-full transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-muted-foreground transition-colors" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              className={cn(
                "h-11 md:h-12 w-full rounded-full border-0 bg-muted/80 pl-12 pr-12 text-base shadow-none transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] text-foreground",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-card focus-visible:shadow-lg sm:placeholder:text-transparent md:placeholder:text-muted-foreground",
                searchFocused && "bg-card shadow-lg ring-2 ring-primary scale-[1.01]"
              )}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSearchQuery(""); setSearchResults([]) }}
                className="absolute right-2 h-8 w-8 rounded-full text-muted-foreground hover:text-destructive transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-110 hover:bg-destructive/10 active:scale-95"
              >
                <X className="h-4 w-4 text-current" />
              </Button>
            )}
          </div>

          {/* Search Dropdown */}
          {showSearchDropdown && (
            <div className="absolute left-0 right-0 top-full z-[60] mt-3 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300 ease-out">
              <div className={cn("flex-1 overflow-y-auto min-h-0 overscroll-contain transition-all duration-500", isSearchExpanded ? "max-h-[70vh]" : "max-h-[400px]")}>
                <div className="p-2">
                  {searchQuery.trim() === "" ? (
                    <div className="animate-in fade-in duration-500">
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Searches</span>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setSearchHistory([]); localStorage.removeItem('ganvo_search_history') }} className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">Clear</button>
                      </div>
                      {searchHistory.map((historyItem, idx) => (
                        <button key={`history-${idx}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setSearchQuery(historyItem)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-all duration-200 hover:bg-muted active:scale-[0.98] text-foreground">
                          <History className="h-4 w-4 text-muted-foreground opacity-70" />
                          <span className="font-medium text-sm">{historyItem}</span>
                        </button>
                      ))}
                    </div>
                  ) : isSearching && searchResults.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-3 text-muted-foreground font-medium">Searching...</span>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-500">
                      {searchResults.slice(0, isSearchExpanded ? undefined : 6).map((song, index) => (
                        <button key={song.videoId} onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToQueueAndPlay(song) }} className="song-card active:scale-[0.98] flex w-full items-center gap-4 rounded-xl p-3 text-left transition-all duration-300 ease-out hover:bg-secondary/60 text-foreground" style={{ animationDelay: `${index * 30}ms` }}>
                          <img src={song.thumbnail || "/placeholder.svg"} alt={song.title} className="h-12 w-12 rounded-lg object-cover shadow-sm transition-transform duration-500 hover:scale-110" />
                          <div className="flex-1 overflow-hidden">
                            <p className="truncate font-medium leading-tight">{song.title}</p>
                            <p className="truncate text-sm text-muted-foreground mt-0.5">{song.artist} {song.album && `• ${song.album}`}</p>
                          </div>
                          <span className="flex-shrink-0 text-xs font-medium text-muted-foreground/80">{formatTime(song.duration)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {searchQuery.trim() !== "" && searchResults.length > 6 && (
                <div className="flex-shrink-0 border-t bg-card/80 backdrop-blur-md p-2">
                  <Button variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsSearchExpanded(!isSearchExpanded) }} className="w-full justify-center gap-2 rounded-lg hover:bg-primary/10 text-foreground transition-all duration-300 active:scale-[0.98]">
                    {isSearchExpanded ? <><ChevronUp className="h-4 w-4 transition-transform duration-300 text-current" />Show less</> : <><ChevronDown className="h-4 w-4 transition-transform duration-300 text-current" />Show all {searchResults.length} results</>}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="hidden sm:flex h-10 w-10 rounded-full text-foreground transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-muted hover:scale-110 active:scale-90">
            {isFullscreen ? <Minimize className="h-5 w-5 text-current" /> : <Maximize className="h-5 w-5 text-current" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-foreground transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-muted hover:scale-110 active:scale-90">
                {user ? (
                  <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                    {user.displayName ? user.displayName.charAt(0) : user.email?.charAt(0) || "U"}
                  </div>
                ) : (
                  <UserCircle2 className="h-5 w-5 text-current" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl animate-in fade-in zoom-in-95 duration-300 ease-out p-2 shadow-xl border-border/50 z-[250]">
              {user ? (
                <div className="px-3 py-2.5 mb-1 bg-muted/50 rounded-xl">
                  <p className="text-sm font-bold truncate text-foreground">{user.displayName || "Library Synced"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              ) : (
                <div className="px-2 py-2 mb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Account</p>
                  <Button onClick={() => setShowAuthDialog(true)} className="w-full justify-start rounded-xl font-semibold transition-all active:scale-[0.98] text-primary-foreground" size="sm">Sign In / Sign Up</Button>
                </div>
              )}
              <DropdownMenuSeparator />
              {user && (
                <DropdownMenuItem onClick={() => setShowAccountSettings(true)} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium transition-colors active:scale-[0.98] text-foreground">
                  <UserCircle2 className="h-4 w-4 text-muted-foreground text-current" /> Account Details
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShowSettingsDialog(true)} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium transition-colors active:scale-[0.98] text-foreground">
                <Settings className="h-4 w-4 text-muted-foreground text-current" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAboutDialog(true)} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium transition-colors active:scale-[0.98] text-foreground">
                <Info className="h-4 w-4 text-muted-foreground text-current" /> About Ganvo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowCreditsDialog(true)} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium transition-colors active:scale-[0.98] text-foreground">
                <Heart className="h-4 w-4 text-muted-foreground text-current" /> Credits & APIs
              </DropdownMenuItem>
              {user && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium text-destructive focus:text-destructive transition-colors active:scale-[0.98]">
                    <LogOut className="h-4 w-4 text-current" /> Sign Out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden min-h-0 bg-background/50 relative">
        
        {/* Left Side / Main View Area */}
        <div className="flex flex-1 flex-col overflow-y-auto min-h-0 z-10 pb-40 lg:pb-0 transition-all duration-500 ease-out">
          
          {/* Explore / Top Artists View */}
          {activeTab === 'explore' ? (
             <div className="p-6 md:p-10 max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
               <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2 text-foreground">Explore</h2>
               <p className="text-muted-foreground font-medium mb-10 text-lg">Discover top global artists and trending music.</p>
               
               {isExploreLoading ? (
                 <div className="flex flex-col items-center justify-center py-32">
                   <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                   <p className="font-bold text-lg text-muted-foreground">Discovering Music...</p>
                 </div>
               ) : exploreError ? (
                 <div className="flex flex-col items-center justify-center py-32 text-center">
                    <TrendingUp className="h-16 w-16 text-muted-foreground/40 mb-6" />
                    <p className="font-extrabold text-2xl mb-2 text-foreground">Explore Unavailable</p>
                    <p className="text-sm font-medium text-muted-foreground max-w-[300px]">Servers are temporarily busy. Use the search bar to find music.</p>
                 </div>
               ) : (
                 <div className="space-y-12">
                   {exploreData?.artists?.length > 0 && (
                     <div>
                       <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground"><UserCircle2 className="h-6 w-6 text-primary"/> Top Artists</h3>
                       <div className="flex overflow-x-auto pb-4 gap-6 snap-x no-scrollbar px-1">
                          {exploreData.artists.map((artist, idx) => (
                            <div key={artist.artistId || idx} onClick={() => loadArtistView(artist.artistId)} className="group flex flex-col items-center gap-4 cursor-pointer snap-start w-32 sm:w-40 shrink-0">
                              <div className="relative w-full aspect-square rounded-full overflow-hidden shadow-lg transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-105 group-active:scale-95">
                                <img src={artist.thumbnail || "/placeholder.svg"} alt={artist.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              </div>
                              <div className="text-center w-full px-2">
                                <p className="font-bold text-sm truncate transition-colors group-hover:text-primary text-foreground">{artist.name}</p>
                                <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">{artist.subscribers}</p>
                              </div>
                            </div>
                          ))}
                       </div>
                     </div>
                   )}
                   {exploreData?.songs?.length > 0 && (
                     <div>
                       <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground"><TrendingUp className="h-6 w-6 text-primary"/> Top Songs</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {exploreData.songs.slice(0, 9).map((song, idx) => (
                            <div key={idx} className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-muted transition-colors duration-300 ease-out bg-card shadow-sm border">
                              <img src={song.thumbnail} className="h-14 w-14 rounded-xl object-cover shadow-sm transition-transform duration-500 group-hover:scale-105" />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate text-foreground">{song.title}</p>
                                <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">{song.artist}</p>
                              </div>
                              <Button variant="secondary" size="icon" onClick={() => addToQueueAndPlay(song)} className="rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 active:scale-95 text-foreground h-10 w-10">
                                <Play className="h-5 w-5 fill-current text-current translate-x-[1px]"/>
                              </Button>
                            </div>
                          ))}
                       </div>
                     </div>
                   )}
                   {exploreData?.albums?.length > 0 && (
                     <div>
                       <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground"><Disc3 className="h-6 w-6 text-primary"/> Top Albums</h3>
                       <div className="flex overflow-x-auto pb-4 gap-6 snap-x no-scrollbar px-1">
                          {exploreData.albums.map((album, idx) => (
                            <div key={idx} className="flex flex-col gap-3 w-40 sm:w-48 shrink-0 group cursor-pointer snap-start">
                              <div className="overflow-hidden rounded-2xl shadow-md transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-105 group-active:scale-95 aspect-square relative">
                                <img src={album.thumbnail} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <p className="font-bold text-sm truncate text-foreground">{album.title}</p>
                                <p className="text-xs font-medium text-muted-foreground mt-0.5">{album.artist} • {album.year}</p>
                              </div>
                            </div>
                          ))}
                       </div>
                     </div>
                   )}
                 </div>
               )}
             </div>
          ) : activeTab === 'artist' ? (
             /* Specific Artist View */
             <div className="p-4 md:p-10 max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-right-8 duration-700 ease-out">
                <Button variant="ghost" onClick={() => setActiveTab('explore')} className="mb-6 -ml-2 md:-ml-4 gap-2 font-bold text-muted-foreground hover:text-foreground transition-all">
                  <SkipBack className="h-4 w-4 fill-current text-current" /> Back to Explore
                </Button>
                {isArtistLoading ? (
                  <div className="flex flex-col items-center justify-center py-32">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                    <p className="font-bold text-lg text-muted-foreground">Loading Artist Profile...</p>
                  </div>
                ) : currentArtistData ? (
                  <div className="animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-12 p-4 md:p-8 bg-card/50 rounded-[2.5rem] border shadow-sm backdrop-blur-sm">
                      <img src={currentArtistData.thumbnails?.[currentArtistData.thumbnails.length-1]?.url || "/placeholder.svg"} alt={currentArtistData.name} className="w-48 h-48 md:w-56 md:h-56 rounded-full object-cover shadow-xl" />
                      <div className="text-center md:text-left flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-center md:justify-start gap-2 text-primary font-bold text-sm mb-2 uppercase tracking-widest"><MicVocal className="h-4 w-4 text-current"/> Artist</div>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-2 text-foreground">{currentArtistData.name}</h1>
                        <p className="text-muted-foreground font-semibold mb-4 text-lg">{currentArtistData.subscribers}</p>
                        <p className="text-sm leading-relaxed max-w-3xl text-muted-foreground/90 line-clamp-3 md:line-clamp-none">{currentArtistData.description}</p>
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold mb-4 md:mb-6 flex items-center gap-2 text-foreground"><TrendingUp className="h-6 w-6 text-primary"/> Top Songs</h3>
                    <div className="space-y-1 md:space-y-2 mb-12 bg-card p-4 rounded-[2rem] border shadow-sm">
                      {currentArtistData.topSongs?.map((song: any, idx: number) => (
                        <div key={song.videoId} className="group flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-2xl hover:bg-muted transition-colors duration-300 ease-out">
                          <span className="w-6 text-center font-bold text-muted-foreground/50">{idx + 1}</span>
                          <img src={song.thumbnail} className="h-12 w-12 rounded-xl object-cover shadow-sm transition-transform duration-500 group-hover:scale-105" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate text-foreground">{song.title}</p>
                            <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">{song.album}</p>
                          </div>
                          <Button variant="secondary" size="sm" onClick={() => addToQueueAndPlay(song)} className="rounded-full font-bold opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 active:scale-95 shadow-sm text-foreground">
                            <Play className="h-4 w-4 md:mr-1 fill-current text-current"/> <span className="hidden md:inline">Play</span>
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleLike(song)} className={cn("text-muted-foreground hover:text-[var(--google-red)] transition-all", likedSongs.has(song.videoId) && "text-[var(--google-red)]")}>
                            <Heart className={cn("h-5 w-5", likedSongs.has(song.videoId) && "fill-current text-current")} />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {currentArtistData.albums?.length > 0 && (
                      <div className="mb-12">
                        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground"><Disc3 className="h-6 w-6 text-primary"/> Albums</h3>
                        <div className="flex overflow-x-auto pb-4 gap-4 snap-x no-scrollbar">
                          {currentArtistData.albums.map((album: any, idx: number) => (
                            <div key={idx} className="flex flex-col gap-3 w-40 sm:w-48 shrink-0 group cursor-pointer snap-start">
                              <div className="overflow-hidden rounded-2xl shadow-md transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-105 group-active:scale-95 aspect-square relative">
                                <img src={album.thumbnail} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <p className="font-bold text-sm truncate text-foreground">{album.title}</p>
                                <p className="text-xs font-medium text-muted-foreground mt-0.5">{album.year}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {currentArtistData.singles?.length > 0 && (
                      <div className="mb-8">
                        <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-foreground"><Music2 className="h-6 w-6 text-primary"/> Singles & EPs</h3>
                        <div className="flex overflow-x-auto pb-4 gap-4 snap-x no-scrollbar">
                          {currentArtistData.singles.map((single: any, idx: number) => (
                            <div key={idx} className="flex flex-col gap-3 w-40 sm:w-48 shrink-0 group cursor-pointer snap-start">
                              <div className="overflow-hidden rounded-2xl shadow-md transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-105 group-active:scale-95 aspect-square relative">
                                <img src={single.thumbnail} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <p className="font-bold text-sm truncate text-foreground">{single.title}</p>
                                <p className="text-xs font-medium text-muted-foreground mt-0.5">{single.year}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p>Failed to load artist.</p>
                )}
             </div>
          ) : (
            /* Player Area (Desktop Default) - Only show if not on Explore or Artist */
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 md:px-8">
              {currentSong ? (
                <div className="flex w-full max-w-[480px] flex-col items-center animate-in fade-in zoom-in-95 duration-700 ease-out">
                  
                  {/* Default Album Art */}
                  <div
                    className={cn(
                      "aspect-square w-full max-w-[320px] mx-auto overflow-hidden relative transition-all duration-700 ease-out shadow-2xl mb-8",
                      dynamicTheme ? "rounded-[2rem]" : "rounded-2xl",
                      isPlaying && "scale-[1.02] shadow-[0_20px_50px_rgba(0,0,0,0.3)]",
                      // On mobile, if we are in this view but they tapped lyrics/library, we'd normally hide it. 
                      (activeTab === 'lyrics' || activeTab === 'library') && "hidden lg:block"
                    )}
                  >
                    <img
                      src={currentSong.thumbnail || "/placeholder.svg"}
                      alt={currentSong.title}
                      className={cn("h-full w-full object-cover transition-transform duration-[2s] ease-out", isPlaying ? "scale-105" : "scale-100")}
                    />
                  </div>

                  {/* Song Info */}
                  <div className="mb-8 flex w-full items-center justify-between gap-4 px-2">
                    <div className="flex-1 min-w-0 text-center">
                      <h2 className="mb-1 truncate text-2xl font-extrabold tracking-tight sm:text-3xl text-foreground transition-colors">{currentSong.title}</h2>
                      <button 
                        onClick={() => currentSong.artistId && loadArtistView(currentSong.artistId)}
                        className="truncate text-base font-semibold text-muted-foreground/80 hover:text-primary hover:underline transition-colors"
                      >
                        {currentSong.artist}
                      </button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleLike(currentSong)}
                      className={cn("h-12 w-12 rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-muted active:scale-75 text-foreground", likedSongs.has(currentSong.videoId) && "text-[var(--google-red)] hover:text-[var(--google-red)] hover:bg-[var(--google-red)]/10")}
                    >
                      <Heart className={cn("h-6 w-6 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]", likedSongs.has(currentSong.videoId) && "fill-current text-current scale-110 drop-shadow-md")} />
                    </Button>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-8 w-full px-2 transition-all duration-500">
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={0.1}
                      onValueChange={handleSeek}
                      className="mb-3 cursor-grab active:cursor-grabbing [&_[data-slot=range]]:bg-primary [&_[data-slot=thumb]]:transition-transform [&_[data-slot=thumb]]:duration-300 [&_[data-slot=thumb]]:ease-out [&_[data-slot=thumb]]:h-4 [&_[data-slot=thumb]]:w-4 [&_[data-slot=thumb]]:border-2[&_[data-slot=thumb]]:hover:scale-150 [&_[data-slot=track]]:h-2 [&_[data-slot=track]]:bg-muted"
                    />
                    <div className="flex justify-between text-xs font-bold tabular-nums text-muted-foreground/70">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Playback Controls */}
                  <div className="mb-8 flex items-center justify-center gap-4 sm:gap-6 w-full">
                    <Button variant="ghost" size="icon" onClick={() => setShuffle(!shuffle)} className={cn("h-12 w-12 rounded-full transition-all duration-300 active:scale-90 flex items-center justify-center", shuffle ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Shuffle className="h-5 w-5 text-current" /></Button>
                    <Button variant="ghost" size="icon" onClick={playPrevious} className="h-14 w-14 rounded-full transition-all duration-300 hover:bg-muted active:scale-75 flex items-center justify-center text-foreground"><SkipBack className="h-7 w-7 fill-current text-current" /></Button>
                    <Button onClick={togglePlay} disabled={isLoading || !audioUrl} className={cn("h-16 w-16 sm:h-20 sm:w-20 rounded-[2rem] bg-primary text-primary-foreground shadow-xl transition-all duration-400 ease-out hover:scale-110 active:scale-90 flex items-center justify-center", isPlaying && "scale-105 rounded-[1.5rem]")}>
                      {isLoading ? <Loader2 className="h-7 w-7 animate-spin text-current" /> : isPlaying ? <Pause className="h-7 w-7 fill-current text-current" /> : <Play className="h-7 w-7 fill-current text-current translate-x-[2px]" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={playNext} className="h-14 w-14 rounded-full transition-all duration-300 hover:bg-muted active:scale-75 flex items-center justify-center text-foreground"><SkipForward className="h-7 w-7 fill-current text-current" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")} className={cn("h-12 w-12 rounded-full transition-all duration-300 active:scale-90 flex items-center justify-center", repeatMode !== "off" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                      {repeatMode === "one" ? <Repeat1 className="h-5 w-5 text-current" /> : <Repeat className="h-5 w-5 text-current" />}
                    </Button>
                  </div>

                  {/* Volume Control */}
                  <div className="flex w-full items-center justify-between gap-3 px-2">
                    <div className="flex flex-1 items-center gap-3 rounded-2xl bg-muted/60 backdrop-blur-sm px-4 py-3 transition-all duration-300 hover:bg-muted/80">
                      <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8 flex-shrink-0 rounded-full p-0 transition-transform duration-300 hover:scale-110 active:scale-90 flex items-center justify-center text-foreground"><VolumeIcon className="h-5 w-5 text-current" /></Button>
                      <Slider value={[isMuted ? 0 : volume]} max={100} step={1} onValueChange={handleVolumeChange} className="flex-1 cursor-grab active:cursor-grabbing [&_[data-slot=range]]:bg-foreground[&_[data-slot=thumb]]:h-4 [&_[data-slot=thumb]]:w-4 [&_[data-slot=track]]:h-1.5 [&_[data-slot=track]]:bg-foreground/10" />
                      <span className="w-8 flex-shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground">{isMuted ? 0 : volume}%</span>
                    </div>
                    <Button variant="secondary" size="icon" onClick={() => setShowEffectsDialog(true)} className="h-12 w-12 flex-shrink-0 rounded-2xl transition-transform duration-300 hover:scale-110 active:scale-90 text-foreground shadow-sm">
                      <AudioLines className="h-5 w-5 text-current" />
                    </Button>
                  </div>
                  
                  {/* Invisible spacer block so you can scroll far past the floating player */}
                  <div className="h-40 shrink-0 lg:hidden w-full opacity-0 pointer-events-none" />
                </div>
              ) : (
                <div className="flex flex-col items-center px-4 text-center animate-in fade-in zoom-in-95 duration-700 ease-out">
                  <div className="mb-8 flex h-40 w-40 items-center justify-center rounded-[2.5rem] bg-muted/50 shadow-inner transition-all duration-700 hover:scale-105">
                    <Music2 className="h-20 w-20 text-muted-foreground/40 transition-transform duration-700" />
                  </div>
                  <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-foreground transition-colors">Start Listening</h2>
                  <p className="max-w-xs text-base font-medium text-muted-foreground/80 leading-relaxed transition-colors">
                    Search for songs or check the Explore tab to find music.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Desktop Sidebar - Queue, Lyrics, Library, Explore */}
        <div className="hidden w-80 flex-col border-l border-border/40 bg-card/40 backdrop-blur-2xl lg:flex xl:w-[420px] overflow-hidden min-h-0 shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-20 transition-all duration-500">
          <div className="flex p-3 gap-2 bg-muted/20 border-b border-border/40 flex-wrap transition-colors duration-300">
            {['explore', 'queue', 'lyrics', 'library'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-300 ease-out active:scale-95 flex-1",
                  activeTab === tab ? "bg-background shadow-sm text-foreground scale-105" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                {tab === 'explore' && <TrendingUp className="h-4 w-4 text-current" />}
                {tab === 'queue' && <ListMusic className="h-4 w-4 text-current" />}
                {tab === 'lyrics' && <Mic2 className="h-4 w-4 text-current" />}
                {tab === 'library' && <Library className="h-4 w-4 text-current" />}
                <span className="capitalize">{tab}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain transition-all duration-500">
            {activeTab === 'explore' ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="font-bold text-lg text-foreground">Explore is open</p>
                <p className="text-sm text-muted-foreground mt-2">Check the main view to discover new artists.</p>
              </div>
            ) : activeTab === 'lyrics' ? (
              <div ref={lyricsContainerRef} className="h-full overflow-y-auto no-scrollbar scroll-smooth lyrics-scroll-container pb-32">
                {lyrics?.syncedLyrics ? (
                  <div className="space-y-5 p-6">
                    {lyrics.syncedLyrics.map((line, index) => (
                      <p key={index} onClick={() => { if (audioRef.current) audioRef.current.currentTime = line.time }} className={cn("lyric-line transition-all duration-500 ease-out cursor-pointer rounded-2xl px-4 py-3 text-lg font-bold leading-relaxed text-center", index === currentLyricIndex ? "lyric-active-line scale-[1.05] bg-primary/10 text-primary shadow-sm" : index < currentLyricIndex ? "text-muted-foreground/30 scale-95" : "text-muted-foreground/70 hover:bg-muted hover:text-foreground scale-95")}>
                        {line.text}
                      </p>
                    ))}
                  </div>
                ) : lyrics?.plainLyrics ? (
                  <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground font-medium text-base text-center animate-in fade-in duration-500 p-6">{lyrics.plainLyrics}</p>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center"><Mic2 className="h-10 w-10 text-muted-foreground/40 mb-6" /><p className="font-extrabold text-xl mb-2 text-foreground">No lyrics found</p></div>
                )}
              </div>
            ) : activeTab === 'library' ? (
               <div className="p-4 space-y-6 pb-32 animate-in slide-in-from-bottom-8 duration-700 ease-out">
                  {/* Playlists Section */}
                  <div>
                    <div className="mb-4 px-2 flex items-center justify-between">
                      <h3 className="font-bold text-lg flex items-center gap-2 text-foreground"><ListPlus className="h-5 w-5 text-current"/> Playlists</h3>
                      <Button variant="secondary" size="sm" onClick={() => setShowPlaylistDialog(true)} className="rounded-xl font-bold text-xs h-8 text-foreground">New</Button>
                    </div>
                    {playlists.length > 0 ? (
                      <div className="space-y-2">
                        {playlists.map((playlist) => (
                          <div key={playlist.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 hover:bg-muted transition-colors cursor-pointer text-foreground">
                            <div className="h-12 w-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black shadow-sm"><ListMusic className="h-5 w-5 text-current"/></div>
                            <div>
                              <p className="font-bold text-sm">{playlist.name}</p>
                              <p className="text-xs font-medium text-muted-foreground">{playlist.songs.length} songs</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground px-2 font-medium">No playlists created yet.</p>
                    )}
                  </div>

                  {/* Liked Songs Section */}
                  <div>
                    <div className="mb-4 px-2 flex items-center justify-between">
                      <h3 className="font-bold text-lg flex items-center gap-2 text-foreground"><Heart className="h-5 w-5 text-[var(--google-red)] fill-current"/> Liked Songs</h3>
                    </div>
                    {savedSongs.length > 0 ? (
                      <div className="space-y-2">
                        {savedSongs.map((song, index) => (
                          <div key={`lib-${song.videoId}-${index}`} className="group flex items-center gap-3 rounded-2xl p-2 transition-all duration-300 hover:bg-muted">
                            <button onClick={() => playFromLibrary(song)} className="flex flex-1 items-center gap-3 text-left outline-none">
                              <img src={song.thumbnail} className="aspect-square w-12 rounded-xl object-cover shadow-sm transition-transform duration-500 group-hover:scale-105" />
                              <div className="flex-1 overflow-hidden">
                                <p className="truncate text-sm font-bold leading-tight text-foreground transition-colors">{song.title}</p>
                                <p className="truncate text-xs font-medium text-muted-foreground mt-0.5 transition-colors">{song.artist}</p>
                              </div>
                            </button>
                            {/* Playlist Add Button Dropdown */}
                            {playlists.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"><ListPlus className="h-4 w-4 text-current" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-2xl z-[300]">
                                  <DropdownMenuItem disabled className="font-bold text-xs uppercase text-muted-foreground">Add to Playlist</DropdownMenuItem>
                                  {playlists.map(pl => (
                                    <DropdownMenuItem key={pl.id} onClick={() => addSongToPlaylist(pl.id, song)} className="font-semibold cursor-pointer rounded-xl py-2">{pl.name}</DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => toggleLike(song)} className="h-8 w-8 text-[var(--google-red)] opacity-100 flex items-center justify-center transition-all duration-300 hover:bg-[var(--google-red)]/10 active:scale-90">
                              <Heart className="h-4 w-4 fill-current text-current transition-transform duration-500 hover:scale-110" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground px-2 font-medium">Like songs to see them here.</p>
                    )}
                  </div>
               </div>
            ) : (
              <div className="p-3 space-y-2 pb-32 animate-in slide-in-from-bottom-8 duration-700 ease-out">
                {queue.length > 0 ? (
                  queue.map((song, index) => (
                    <div key={`${song.videoId}-${index}`} className={cn("group flex items-center gap-3 rounded-2xl p-2 transition-all duration-300 hover:bg-muted/80", index === currentIndex ? "bg-primary/5 shadow-sm border border-primary/10 scale-[1.02]" : "border border-transparent")}>
                      <button onClick={() => setCurrentIndex(index)} className="flex flex-1 items-center gap-4 text-left outline-none">
                        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl shadow-sm"><img src={song.thumbnail} className="h-full w-full object-cover" /></div>
                        <div className="flex-1 overflow-hidden">
                          <p className={cn("truncate text-sm font-bold leading-tight", index === currentIndex ? "text-primary" : "text-foreground")}>{song.title}</p>
                          <p className="truncate text-xs font-semibold text-muted-foreground mt-0.5">{song.artist}</p>
                        </div>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => removeFromQueue(index)} className="h-10 w-10 rounded-full opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-destructive/10 text-destructive focus:opacity-100"><X className="h-4 w-4 text-current" /></Button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center"><ListMusic className="h-10 w-10 text-muted-foreground/40 mb-6" /><p className="font-extrabold text-xl mb-2 text-foreground">Queue is empty</p></div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- EXPANDABLE MOBILE PLAYER OVERLAY --- */}
      <div 
        className={cn(
          "fixed inset-0 z-[200] bg-background flex flex-col transition-transform duration-500 ease-out lg:hidden",
          isMobilePlayerExpanded ? "translate-y-0" : "translate-y-[100%]"
        )}
      >
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => setIsMobilePlayerExpanded(false)} className="h-12 w-12 rounded-full hover:bg-muted active:scale-90 text-foreground">
            <ChevronDown className="h-8 w-8 text-current" />
          </Button>
          <div className="flex bg-muted/50 rounded-full p-1 gap-1">
            <Button variant={mobilePlayerTab === 'player' ? 'default' : 'ghost'} size="sm" onClick={() => setMobilePlayerTab('player')} className="rounded-full px-4 font-bold text-xs text-foreground">Player</Button>
            <Button variant={mobilePlayerTab === 'lyrics' ? 'default' : 'ghost'} size="sm" onClick={() => setMobilePlayerTab('lyrics')} className="rounded-full px-4 font-bold text-xs text-foreground">Lyrics</Button>
            <Button variant={mobilePlayerTab === 'queue' ? 'default' : 'ghost'} size="sm" onClick={() => setMobilePlayerTab('queue')} className="rounded-full px-4 font-bold text-xs text-foreground">Queue</Button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowPlayerSettings(true)} className="h-12 w-12 rounded-full hover:bg-muted active:scale-90 text-foreground">
            <MoreVertical className="h-6 w-6 text-current" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 relative px-6 pb-6 pt-4 flex flex-col">
          {mobilePlayerTab === 'player' && currentSong && (
            <div className="flex flex-col items-center h-full animate-in fade-in zoom-in-95 duration-500 flex-1 justify-center">
              {/* Responsive Square Album Art */}
              <div className="aspect-square w-full max-w-[320px] mx-auto overflow-hidden rounded-[2rem] shadow-2xl relative mb-8">
                 <img src={currentSong.thumbnail} className={cn("w-full h-full object-cover transition-transform duration-[2s]", isPlaying ? "scale-105" : "scale-100")} />
                 {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-md">
                      <Loader2 className="h-12 w-12 animate-spin text-white mb-2" />
                    </div>
                  )}
              </div>
              
              <div className="w-full flex items-center justify-between gap-4 mb-6">
                 <div className="flex-1 min-w-0">
                    <h2 className="text-3xl font-extrabold truncate text-foreground mb-1">{currentSong.title}</h2>
                    <p className="text-lg font-semibold text-muted-foreground truncate">{currentSong.artist}</p>
                 </div>
                 <Button variant="ghost" size="icon" onClick={() => toggleLike(currentSong)} className="h-14 w-14 rounded-full text-foreground hover:bg-[var(--google-red)]/10">
                    <Heart className={cn("h-8 w-8 transition-all", likedSongs.has(currentSong.videoId) ? "fill-[var(--google-red)] text-[var(--google-red)] scale-110" : "text-current")} />
                 </Button>
              </div>

              <div className="w-full mb-8">
                <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="mb-4 [&_[data-slot=range]]:bg-primary [&_[data-slot=thumb]]:h-5[&_[data-slot=thumb]]:w-5 [&_[data-slot=track]]:h-2" />
                <div className="flex justify-between text-sm font-bold text-muted-foreground">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between w-full mb-8 px-2">
                <Button variant="ghost" size="icon" onClick={() => setShuffle(!shuffle)} className={cn("h-12 w-12 rounded-full flex items-center justify-center", shuffle ? "bg-primary/20 text-primary" : "text-foreground")}><Shuffle className="h-6 w-6 text-current" /></Button>
                <Button variant="ghost" size="icon" onClick={playPrevious} className="h-16 w-16 rounded-full text-foreground flex items-center justify-center"><SkipBack className="h-8 w-8 fill-current text-current" /></Button>
                <Button onClick={togglePlay} className="h-20 w-20 rounded-[2rem] bg-primary text-primary-foreground shadow-xl hover:scale-105 transition-transform active:scale-95 flex items-center justify-center">
                   {isPlaying ? <Pause className="h-8 w-8 fill-primary-foreground text-primary-foreground" /> : <Play className="h-8 w-8 fill-primary-foreground text-primary-foreground translate-x-[2px]" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={playNext} className="h-16 w-16 rounded-full text-foreground flex items-center justify-center"><SkipForward className="h-8 w-8 fill-current text-current" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")} className={cn("h-12 w-12 rounded-full flex items-center justify-center", repeatMode !== "off" ? "bg-primary/20 text-primary" : "text-foreground")}>
                  {repeatMode === "one" ? <Repeat1 className="h-6 w-6 text-current" /> : <Repeat className="h-6 w-6 text-current" />}
                </Button>
              </div>

              <div className="flex w-full items-center justify-between gap-3 px-2">
                <div className="flex flex-1 items-center gap-3 rounded-2xl bg-muted/60 backdrop-blur-sm px-4 py-3 transition-all duration-300 hover:bg-muted/80">
                  <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8 flex-shrink-0 rounded-full p-0 transition-transform duration-300 hover:scale-110 active:scale-90 flex items-center justify-center text-foreground"><VolumeIcon className="h-5 w-5 text-current" /></Button>
                  <Slider value={[isMuted ? 0 : volume]} max={100} step={1} onValueChange={handleVolumeChange} className="flex-1 cursor-grab active:cursor-grabbing [&_[data-slot=range]]:bg-foreground [&_[data-slot=thumb]]:h-4 [&_[data-slot=thumb]]:w-4 [&_[data-slot=track]]:h-1.5 [&_[data-slot=track]]:bg-foreground/10" />
                  <span className="w-8 flex-shrink-0 text-right text-xs font-bold tabular-nums text-muted-foreground">{isMuted ? 0 : volume}%</span>
                </div>
                <Button variant="secondary" size="icon" onClick={() => setShowEffectsDialog(true)} className="h-12 w-12 flex-shrink-0 rounded-2xl transition-transform duration-300 hover:scale-110 active:scale-90 text-foreground shadow-sm">
                  <AudioLines className="h-5 w-5 text-current" />
                </Button>
              </div>

            </div>
          )}

          {mobilePlayerTab === 'lyrics' && (
             <div className="h-full overflow-y-auto no-scrollbar scroll-smooth lyrics-scroll-container pb-32">
                {lyrics?.syncedLyrics ? (
                  <div className="space-y-6 py-10">
                    {lyrics.syncedLyrics.map((line, index) => (
                      <p key={index} onClick={() => { if (audioRef.current) audioRef.current.currentTime = line.time }} className={cn("lyric-line transition-all duration-500 ease-out cursor-pointer rounded-3xl px-6 py-4 text-3xl font-extrabold leading-tight text-center", index === currentLyricIndex ? "lyric-active-line scale-[1.05] bg-primary/10 text-primary shadow-sm" : index < currentLyricIndex ? "text-muted-foreground/30 scale-95" : "text-muted-foreground/70 hover:bg-muted hover:text-foreground scale-95")}>
                        {line.text}
                      </p>
                    ))}
                  </div>
                ) : lyrics?.plainLyrics ? (
                  <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground font-semibold text-2xl animate-in fade-in duration-500 py-10 px-2">{lyrics.plainLyrics}</p>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full"><Mic2 className="h-16 w-16 text-muted-foreground/40 mb-6" /><p className="font-extrabold text-2xl mb-2 text-foreground">No lyrics found</p></div>
                )}
             </div>
          )}

          {mobilePlayerTab === 'queue' && (
             <div className="h-full overflow-y-auto pb-32">
                <h3 className="font-extrabold text-2xl mb-6 flex items-center gap-3 text-foreground"><ListMusic className="text-primary"/> Up Next</h3>
                <div className="space-y-3">
                  {queue.map((song, index) => (
                    <div key={`${song.videoId}-${index}`} className={cn("group flex items-center gap-4 rounded-2xl p-3 transition-all duration-300", index === currentIndex ? "bg-primary/10 shadow-sm border border-primary/20" : "hover:bg-muted/80")}>
                      <button onClick={() => setCurrentIndex(index)} className="flex flex-1 items-center gap-4 text-left outline-none min-w-0">
                        <img src={song.thumbnail} className="h-16 w-16 aspect-square rounded-xl object-cover shadow-sm flex-shrink-0" />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <p className={cn("truncate text-base font-bold", index === currentIndex ? "text-primary" : "text-foreground")}>{song.title}</p>
                          <p className="truncate text-sm font-semibold text-muted-foreground mt-0.5">{song.artist}</p>
                        </div>
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => removeFromQueue(index)} className="h-12 w-12 rounded-full text-destructive bg-destructive/10"><X className="h-5 w-5 text-current" /></Button>
                    </div>
                  ))}
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Mini Bottom Player (Mobile) - Clicks to Expand */}
      {currentSong && !isMobilePlayerExpanded && (
        <div className="fixed bottom-4 left-4 right-4 z-[100] transition-all duration-500 ease-out lg:hidden">
          <div onClick={() => setIsMobilePlayerExpanded(true)} className="flex items-center gap-3 rounded-[2rem] bg-card/95 p-2.5 backdrop-blur-xl border border-border/50 shadow-[0_10px_40px_rgba(0,0,0,0.2)] transition-all duration-500 cursor-pointer active:scale-[0.98]">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-[1.25rem] shadow-sm">
              <img src={currentSong.thumbnail || "/placeholder.svg"} className={cn("h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.2,0,0,1)]", isPlaying ? "scale-110" : "scale-100")} />
            </div>
            <div className="flex-1 overflow-hidden flex flex-col justify-center px-1">
              <p className="truncate text-sm font-extrabold leading-tight transition-colors text-foreground">{currentSong.title}</p>
              <p className="truncate text-xs font-semibold text-muted-foreground mt-0.5 transition-colors">{currentSong.artist}</p>
            </div>
            <Button onClick={(e) => { e.stopPropagation(); toggleLike(currentSong) }} variant="ghost" size="icon" className={cn("h-12 w-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 text-foreground", likedSongs.has(currentSong.videoId) && "text-[var(--google-red)] hover:text-[var(--google-red)]")}>
              <Heart className={cn("h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]", likedSongs.has(currentSong.videoId) ? "fill-current scale-110 text-current" : "text-current")} />
            </Button>
            <Button onClick={(e) => { e.stopPropagation(); togglePlay() }} disabled={isLoading || !audioUrl} className={cn("h-14 w-14 flex flex-shrink-0 items-center justify-center rounded-[1.5rem] shadow-lg transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] active:scale-90", isPlaying ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-current" /> : isPlaying ? <Pause className="h-6 w-6 fill-primary-foreground text-primary-foreground" /> : <Play className="h-6 w-6 fill-primary-foreground text-primary-foreground translate-x-[1px]" />}
            </Button>
          </div>
        </div>
      )}

      {/* --- ALL DIALOGS (SETTINGS, EFFECTS, AUTH, PLAYLISTS, CREDITS) --- */}
      
      {/* Audio Effects Dialog (Tempo & Pitch) */}
      <Dialog open={showEffectsDialog} onOpenChange={setShowEffectsDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-0 shadow-2xl animate-in zoom-in-95 duration-500 ease-out outline-none bg-background !z-[300]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold flex items-center gap-3 text-foreground"><AudioLines className="h-6 w-6 text-primary"/> Audio Effects</DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground mt-2">Adjust playback speed and pitch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-8 mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-foreground">Playback Speed</label>
                <span className="text-xs font-bold bg-muted px-2.5 py-1 rounded-full">{playbackRate.toFixed(2)}x</span>
              </div>
              <Slider 
                value={[playbackRate]} 
                min={0.5} max={2.0} step={0.05} 
                onValueChange={(val) => setPlaybackRate(val[0])} 
                className="[&_[data-slot=range]]:bg-primary [&_[data-slot=thumb]]:h-5 [&_[data-slot=thumb]]:w-5" 
              />
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>0.5x</span>
                <span>Normal</span>
                <span>2.0x</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl">
               <div className="flex flex-col">
                 <span className="font-bold text-foreground">Preserve Pitch</span>
                 <span className="text-xs font-medium text-muted-foreground">Turn off for Nightcore effect</span>
               </div>
               <Switch checked={preservesPitch} onCheckedChange={setPreservesPitch} className="data-[state=checked]:bg-primary" />
            </div>

            <Button onClick={() => {setPlaybackRate(1); setPreservesPitch(true)}} variant="secondary" className="w-full h-12 rounded-xl font-bold">Reset to Default</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Player Settings Dialog */}
      <Dialog open={showPlayerSettings} onOpenChange={setShowPlayerSettings}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-0 border-0 shadow-2xl animate-in zoom-in-95 duration-500 ease-out outline-none overflow-hidden bg-background !z-[300]">
          <div className="flex items-center gap-4 p-5 border-b bg-card/50 backdrop-blur-sm">
            <Button variant="ghost" size="icon" onClick={() => setShowPlayerSettings(false)} className="rounded-full text-foreground"><ArrowLeft className="w-6 h-6 text-current"/></Button>
            <h2 className="text-xl font-extrabold text-foreground">Appearance</h2>
          </div>
          <div className="p-2 overflow-y-auto max-h-[70vh] no-scrollbar">
             <div className="px-4 py-2 space-y-1">
               <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 ml-2">Theme</h3>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><Palette className="w-5 h-5 text-current"/></div>
                   <span className="font-bold text-base text-foreground">Enable dynamic theme</span>
                 </div>
                 <Switch checked={dynamicTheme} onCheckedChange={setDynamicTheme} className="data-[state=checked]:bg-primary" />
               </div>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsDark(!isDark)}>
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><Moon className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-foreground">Dark theme</span>
                     <span className="text-sm font-normal text-muted-foreground">{isDark ? 'On' : 'Off'}</span>
                   </div>
                 </div>
               </div>
             </div>
             
             <div className="px-4 py-4 space-y-1">
               <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 ml-2">Player</h3>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><LayoutTemplate className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-foreground">Player background style</span>
                     <span className="text-sm font-normal text-muted-foreground">Follow theme</span>
                   </div>
                 </div>
               </div>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors opacity-50">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><CornerUpRight className="w-5 h-5 text-current"/></div>
                   <span className="font-bold text-base text-foreground">Customize thumbnail corner radius</span>
                 </div>
                 <ChevronRight className="w-5 h-5 text-primary" />
               </div>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><MousePointerClick className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-foreground">Player buttons style</span>
                     <span className="text-sm font-normal text-muted-foreground">Default style</span>
                   </div>
                 </div>
               </div>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><SlidersHorizontal className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-foreground">Player slider style</span>
                     <span className="text-sm font-normal text-muted-foreground">Default</span>
                   </div>
                 </div>
               </div>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><Hand className="w-5 h-5 text-current"/></div>
                   <span className="font-bold text-base text-foreground">Enable swipe to change song</span>
                 </div>
                 <Switch checked={swipeToChange} onCheckedChange={setSwipeToChange} className="data-[state=checked]:bg-primary" />
               </div>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><RefreshCw className="w-5 h-5 text-current"/></div>
                   <span className="font-bold text-base text-foreground">Rotate the lyrics background</span>
                 </div>
                 <Switch checked={rotateLyricsBg} onCheckedChange={setRotateLyricsBg} className="data-[state=checked]:bg-primary" />
               </div>
             </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-0 shadow-2xl animate-in zoom-in-95 duration-500 ease-out outline-none bg-background !z-[300]">
          <DialogHeader>
            <div className="mb-6 flex justify-center"><div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary/10 text-primary"><UserCircle2 className="h-10 w-10 text-current" /></div></div>
            <DialogTitle className="text-2xl font-extrabold text-center text-foreground">Account Sync</DialogTitle>
            <DialogDescription className="font-medium text-center mt-2">Sign in to save your playlists and liked songs to the cloud.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEmailAuth} className="space-y-4 mt-2">
            <div className="space-y-3">
              <Input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="h-14 rounded-2xl bg-muted/50 border-transparent focus-visible:ring-primary font-medium px-4 text-foreground" />
              <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="h-14 rounded-2xl bg-muted/50 border-transparent focus-visible:ring-primary font-medium px-4 text-foreground" />
            </div>
            {authError && <p className="text-xs font-bold text-destructive text-center p-3 bg-destructive/10 rounded-xl animate-in slide-in-from-top-2">{authError}</p>}
            <Button type="submit" className="w-full h-14 rounded-2xl font-bold text-base shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] text-primary-foreground">{isSignUp ? "Create Account" : "Sign In"}</Button>
            <div className="flex items-center gap-2 my-4"><div className="flex-1 h-px bg-border"></div><span className="text-xs font-bold text-muted-foreground uppercase">OR</span><div className="flex-1 h-px bg-border"></div></div>
            <Button type="button" variant="outline" onClick={handleGoogleSignIn} className="w-full h-14 rounded-2xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-foreground">Continue with Google</Button>
            <p className="text-sm text-center font-bold text-primary mt-4 cursor-pointer hover:underline" onClick={() => {setIsSignUp(!isSignUp); setAuthError("")}}>{isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}</p>
          </form>
        </DialogContent>
      </Dialog>

      {/* Account Settings Dialog */}
      <Dialog open={showAccountSettings} onOpenChange={setShowAccountSettings}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-0 shadow-2xl animate-in zoom-in-95 duration-500 ease-out outline-none bg-background !z-[300]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold flex items-center gap-3 text-foreground"><UserCircle2 className="h-6 w-6 text-primary"/> Account Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-6 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-bold ml-1 text-muted-foreground">Display Name</label>
              <Input value={displayNameInput} onChange={e => setDisplayNameInput(e.target.value)} placeholder="Your Name" className="h-14 rounded-2xl bg-muted/50 border-transparent font-bold px-4 text-lg text-foreground" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold ml-1 text-muted-foreground">Email Address</label>
              <Input value={user?.email || ""} disabled className="h-14 rounded-2xl bg-muted/30 border-transparent font-medium px-4 text-muted-foreground opacity-70" />
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl font-bold text-base shadow-lg transition-transform active:scale-[0.98] text-primary-foreground">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Playlist Dialog */}
      <Dialog open={showPlaylistDialog} onOpenChange={setShowPlaylistDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-0 shadow-2xl animate-in zoom-in-95 duration-500 ease-out outline-none bg-background !z-[300]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold flex items-center gap-3 text-foreground"><ListPlus className="h-6 w-6 text-primary"/> New Playlist</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePlaylist} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Input value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="Playlist Name" autoFocus required className="h-14 rounded-2xl bg-muted/50 border-transparent font-bold px-4 text-lg text-foreground" />
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl font-bold text-base shadow-lg transition-transform active:scale-[0.98] text-primary-foreground">Create Playlist</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* About & Credits Dialogs */}
      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-6 sm:p-8 border-0 shadow-2xl animate-in zoom-in-95 duration-500 ease-out outline-none bg-background !z-[300]"><DialogHeader><div className="mb-5 flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary shadow-lg"><Music2 className="h-8 w-8 text-primary-foreground" /></div><div><DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground">Ganvo Music</DialogTitle><DialogDescription className="font-semibold mt-1">Version 1.0.0</DialogDescription></div></div></DialogHeader><div className="space-y-4 text-sm font-medium text-muted-foreground leading-relaxed mt-2"><p>A modern audio player inspired by Material Design 3 Expressive, featuring seamless YouTube Music search, synchronized lyrics, and fluid animations.</p><p>Built with Next.js App Router, Tailwind CSS, Firebase Auth, and shadcn/ui.</p><div className="flex flex-wrap items-center gap-2 pt-4"><span className="text-xs font-bold uppercase tracking-wider text-foreground">Powered by</span><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground shadow-sm">YouTube Music API</span><span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground shadow-sm">LRCLIB</span></div></div></DialogContent>
      </Dialog>

      <Dialog open={showCreditsDialog} onOpenChange={setShowCreditsDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-6 sm:p-8 border-0 shadow-2xl animate-in zoom-in-95 duration-500 ease-out outline-none bg-background !z-[300]"><DialogHeader><DialogTitle className="flex items-center gap-3 text-2xl font-extrabold tracking-tight text-foreground"><Heart className="h-7 w-7 text-[var(--google-red)] fill-[var(--google-red)]" />Credits</DialogTitle></DialogHeader><div className="space-y-4 mt-4"><div className="rounded-[1.5rem] bg-muted/50 p-5 transition-all duration-300 ease-out hover:scale-[1.02] hover:bg-muted hover:shadow-md border border-transparent hover:border-border/50"><h4 className="mb-2 font-extrabold text-base text-foreground">Inspired By</h4><a href="https://github.com/koiverse/ArchiveTune" target="_blank" className="flex items-center gap-2 text-sm font-bold text-primary hover:underline transition-all active:scale-95 w-fit">ArchiveTune by koiverse<ExternalLink className="h-4 w-4" /></a><p className="mt-2 text-xs font-semibold text-muted-foreground leading-relaxed">Material 3 Expressive YouTube Music client for Android</p></div><div className="rounded-[1.5rem] bg-muted/50 p-5 transition-all duration-300 ease-out hover:scale-[1.02] hover:bg-muted hover:shadow-md border border-transparent hover:border-border/50"><h4 className="mb-3 font-extrabold text-base text-foreground">APIs & Services</h4><ul className="space-y-3 text-sm font-semibold text-muted-foreground"><li className="flex items-center gap-3 group"><span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm" />ytmusic-api (YouTube Music search)</li><li className="flex items-center gap-3 group"><span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-sm" />LRCLIB (Synchronized lyrics)</li><li className="flex items-center gap-3 group"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500 shadow-sm" />Cobalt & Invidious API (Audio streaming)</li></ul></div></div></DialogContent>
      </Dialog>
    </div>
  )
}
