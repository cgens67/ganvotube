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
  User as FirebaseUser 
} from "firebase/auth"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Search,
  Shuffle,
  Repeat,
  Repeat1,
  Sun,
  Moon,
  Loader2,
  Music2,
  X,
  ListMusic,
  Mic2,
  MoreVertical,
  Info,
  Heart,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  Library,
  UserCircle2,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Firebase Configuration (Directly from user)
const firebaseConfig = {
  apiKey: "AIzaSyBI-ABs1S7Ln2jJ7xYxgUZwU1nEXZmqI2c",
  authDomain: "ganvotesting.firebaseapp.com",
  projectId: "ganvotesting",
  storageBucket: "ganvotesting.firebasestorage.app",
  messagingSenderId: "1083596663051",
  appId: "1:1083596663051:web:52900f44e84034b7421a0e"
};

// Safe lazy initialization to prevent Vercel Build Errors
const getFirebase = () => {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  return {
    auth: getAuth(app),
    db: getFirestore(app),
    googleProvider: new GoogleAuthProvider()
  };
};

interface Song {
  videoId: string
  title: string
  artist: string
  album: string
  duration: number
  thumbnail: string
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
  const [isDark, setIsDark] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [queue, setQueue] = useState<Song[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off")
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lyrics, setLyrics] = useState<LyricsData | null>(null)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  
  const [activeTab, setActiveTab] = useState<'queue' | 'lyrics' | 'library'>('queue')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [showAboutDialog, setShowAboutDialog] = useState(false)
  const [showCreditsDialog, setShowCreditsDialog] = useState(false)
  
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [authError, setAuthError] = useState("")
  
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
  const [savedSongs, setSavedSongs] = useState<Song[]>([])
  const [searchFocused, setSearchFocused] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const lyricsContainerRefMobile = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const currentSong = queue[currentIndex]

  // Listen to Auth State
  useEffect(() => {
    const { auth, db } = getFirebase();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid)
        const docSnap = await getDoc(userRef)
        if (docSnap.exists()) {
          const data = docSnap.data()
          if (data.savedSongs) {
            setSavedSongs(data.savedSongs)
            setLikedSongs(new Set(data.savedSongs.map((s: Song) => s.videoId)))
          }
        }
      } else {
        const saved = localStorage.getItem('ganvo_saved_songs')
        if (saved) {
          const parsed = JSON.parse(saved)
          setSavedSongs(parsed)
          setLikedSongs(new Set(parsed.map((s: Song) => s.videoId)))
        }
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    try {
      const history = localStorage.getItem('ganvo_search_history')
      if (history) setSearchHistory(JSON.parse(history))
    } catch (e) {}
  }, [])

  const saveSearch = (query: string) => {
    if (!query.trim()) return
    const newHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, 15)
    setSearchHistory(newHistory)
    localStorage.setItem('ganvo_search_history', JSON.stringify(newHistory))
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError("");
    const { auth } = getFirebase();
    try {
      if (isSignUp) await createUserWithEmailAndPassword(auth, email, password)
      else await signInWithEmailAndPassword(auth, email, password)
      setShowAuthDialog(false); setEmail(""); setPassword("");
    } catch (error: any) { setAuthError(error.message.replace("Firebase: ", "")) }
  }

  const handleGoogleSignIn = async () => {
    const { auth, googleProvider } = getFirebase();
    setAuthError("")
    try { await signInWithPopup(auth, googleProvider); setShowAuthDialog(false) } 
    catch (error: any) { setAuthError(error.message.replace("Firebase: ", "")) }
  }

  const handleSignOut = async () => {
    const { auth } = getFirebase();
    await signOut(auth)
  }

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false); setIsSearchExpanded(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!searchQuery.trim()) { setSearchResults([]); setIsSearching(false); return }
    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()
        setSearchResults(data.results || [])
      } catch (error) { console.error("Search failed:", error) } 
      finally { setIsSearching(false) }
    }, 300)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery])

  const addToQueueAndPlay = async (song: Song) => {
    saveSearch(searchQuery || song.title)
    const existingIndex = queue.findIndex((s) => s.videoId === song.videoId)
    if (existingIndex >= 0) setCurrentIndex(existingIndex)
    else { setQueue((prev) => [...prev, song]); setCurrentIndex(queue.length) }
    setSearchResults([]); setSearchQuery(""); setIsSearchExpanded(false); setSearchFocused(false);
  }

  const playFromLibrary = (song: Song) => addToQueueAndPlay(song)

  useEffect(() => {
    if (!currentSong) return
    const loadStream = async () => {
      setIsLoading(true); setAudioUrl(null); setLoadError(null)
      try {
        const response = await fetch(`/api/music/stream/${currentSong.videoId}`)
        const data = await response.json()
        if (data.error) { setLoadError(data.error); return }
        if (data.audioUrl) setAudioUrl(data.audioUrl)
        else setLoadError("No audio stream available")
      } catch (error) { setLoadError("Network error. Please try again.") } 
      finally { setIsLoading(false) }
    }
    loadStream()
  }, [currentSong?.videoId])

  useEffect(() => {
    if (!currentSong) return
    const loadLyrics = async () => {
      setLyrics(null); setCurrentLyricIndex(-1)
      try {
        const params = new URLSearchParams({
          track: currentSong.title, artist: currentSong.artist,
          ...(currentSong.album && { album: currentSong.album }),
          ...(currentSong.duration && { duration: String(currentSong.duration) }),
        })
        const response = await fetch(`/api/lyrics?${params}`)
        const data = await response.json()
        if (data.syncedLyrics || data.plainLyrics) setLyrics({ syncedLyrics: data.syncedLyrics, plainLyrics: data.plainLyrics })
      } catch (error) { console.error("Failed to load lyrics:", error) }
    }
    loadLyrics()
  }, [currentSong?.videoId])

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl; audioRef.current.load();
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        if (err.name === 'AbortError') return;
        setLoadError("Playback failed. Try again.")
      })
    }
  }, [audioUrl])

  useEffect(() => {
    if (!lyrics?.syncedLyrics) return
    const lyric = lyrics.syncedLyrics.findLast((l) => l.time <= currentTime)
    const index = lyric ? lyrics.syncedLyrics.indexOf(lyric) : -1
    if (index !== currentLyricIndex) {
      setCurrentLyricIndex(index)
      if (index >= 0) {
        lyricsContainerRef.current?.querySelectorAll(".lyric-line")[index]?.scrollIntoView({ behavior: "smooth", block: "center" })
        lyricsContainerRefMobile.current?.querySelectorAll(".lyric-line")[index]?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  }, [currentTime, lyrics, currentLyricIndex])

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play().catch(e => e.name !== 'AbortError' && console.error(e))
    setIsPlaying(!isPlaying)
  }, [isPlaying, audioUrl])

  const playNext = useCallback(() => {
    if (queue.length === 0) return
    let nextIndex = shuffle ? Math.floor(Math.random() * queue.length) : (currentIndex + 1) % queue.length
    if (nextIndex === 0 && repeatMode === "off" && !shuffle) { setIsPlaying(false); return }
    setCurrentIndex(nextIndex)
  }, [queue.length, currentIndex, shuffle, repeatMode])

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return
    if (currentTime > 3) { if (audioRef.current) audioRef.current.currentTime = 0; return }
    setCurrentIndex((currentIndex - 1 + queue.length) % queue.length)
  }, [queue.length, currentIndex, currentTime])

  const handleSeek = (value: number[]) => { if (audioRef.current) { audioRef.current.currentTime = value[0]; setCurrentTime(value[0]) } }
  const handleVolumeChange = (value: number[]) => { 
    setVolume(value[0]); if (audioRef.current) audioRef.current.volume = value[0] / 100 
    setIsMuted(value[0] === 0)
  }

  const toggleLike = async (song: Song) => {
    const { db } = getFirebase();
    setLikedSongs((prev) => {
      const next = new Set(prev)
      let newSaved = [...savedSongs]
      if (next.has(song.videoId)) { next.delete(song.videoId); newSaved = newSaved.filter(s => s.videoId !== song.videoId) } 
      else { next.add(song.videoId); newSaved.unshift(song) }
      setSavedSongs(newSaved)
      if (user && db) setDoc(doc(db, "users", user.uid), { savedSongs: newSaved }, { merge: true }).catch(console.error)
      else localStorage.setItem('ganvo_saved_songs', JSON.stringify(newSaved))
      return next
    })
  }

  const handleRetryStream = async () => {
    if (!currentSong) return; setLoadError(null); setIsLoading(true)
    try {
      const response = await fetch(`/api/music/stream/${currentSong.videoId}`)
      const data = await response.json()
      if (data.audioUrl && audioRef.current) {
        setAudioUrl(data.audioUrl); audioRef.current.src = data.audioUrl; audioRef.current.load();
        audioRef.current.play().then(() => setIsPlaying(true)).catch(e => { if (e.name !== 'AbortError') setLoadError("Retry failed.") })
      } else setLoadError(data.error || "Failed")
    } catch (e) { setLoadError("Network error") } finally { setIsLoading(false) }
  };

  const formatTime = (seconds: number) => { if (!isFinite(seconds)) return "0:00"; const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60); return `${m}:${s.toString().padStart(2, "0")}` }
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2
  const showSearchDropdown = searchFocused && (searchResults.length > 0 || isSearching || (searchQuery.trim() === "" && searchHistory.length > 0))

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background transition-colors duration-500 font-sans antialiased">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
        onError={() => setLoadError("Stream connection lost. Please retry.")}
      />

      {/* Header - MD3 Styled */}
      <header className="elevation-1 z-40 flex h-16 flex-shrink-0 items-center justify-between px-3 md:px-6 relative bg-background/90 backdrop-blur-xl border-b border-border/40 gap-2">
        <div className={cn("flex items-center gap-3 shrink-0 transition-all duration-300", searchFocused && "hidden md:flex")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground shadow-lg transition-transform duration-500 hover:scale-110 hover:rotate-3">
            <Music2 className="h-5 w-5 text-background" />
          </div>
          <div className="hidden sm:flex items-baseline gap-1 select-none">
            <span className="text-xl font-normal text-muted-foreground tracking-tight">Ganvo</span>
            <span className="text-xl font-bold tracking-tight">Music</span>
          </div>
        </div>

        <div ref={searchContainerRef} className="relative flex-1 max-w-2xl mx-auto w-full transition-all duration-300">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
            <Input
              type="text" placeholder="Search songs, artists..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => setSearchFocused(true)}
              className={cn(
                "h-11 md:h-12 w-full rounded-full border-0 bg-muted/80 pl-12 pr-12 text-base shadow-none transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]",
                searchFocused && "bg-card shadow-xl ring-2 ring-primary scale-[1.01]"
              )}
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); setSearchResults([]) }} className="absolute right-2 h-8 w-8 rounded-full transition-all hover:bg-destructive/10">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {showSearchDropdown && (
            <div className="absolute left-0 right-0 top-full z-[60] mt-3 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300 ease-[cubic-bezier(0.2,0,0,1)]">
              <div className={cn("flex-1 overflow-y-auto min-h-0 overscroll-contain transition-all duration-500", isSearchExpanded ? "max-h-[70vh]" : "max-h-[400px]")}>
                <div className="p-2">
                  {searchQuery.trim() === "" ? (
                    <div>
                      <div className="flex items-center justify-between px-3 py-2"><span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent</span><button onClick={() => { setSearchHistory([]); localStorage.removeItem('ganvo_search_history') }} className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">Clear</button></div>
                      {searchHistory.map((item, idx) => (
                        <button key={idx} onMouseDown={e => e.preventDefault()} onClick={() => setSearchQuery(item)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted transition-all duration-200 active:scale-[0.98]"><History className="h-4 w-4 text-muted-foreground opacity-70" /><span className="text-sm font-medium">{item}</span></button>
                      ))}
                    </div>
                  ) : isSearching && searchResults.length === 0 ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-3 text-muted-foreground font-medium">Searching...</span></div>
                  ) : (
                    <div className="animate-in fade-in duration-300">
                      {searchResults.slice(0, isSearchExpanded ? undefined : 6).map((song, idx) => (
                        <button key={idx} onClick={() => addToQueueAndPlay(song)} className="song-card active:scale-[0.98] flex w-full items-center gap-4 rounded-xl p-3 text-left transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-secondary/60">
                          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg shadow-sm"><img src={song.thumbnail} className="h-full w-full object-cover" alt="" /></div>
                          <div className="flex-1 overflow-hidden"><p className="truncate font-medium leading-tight">{song.title}</p><p className="truncate text-sm text-muted-foreground mt-0.5">{song.artist}</p></div>
                          <span className="flex-shrink-0 text-xs font-medium text-muted-foreground/80">{formatTime(song.duration)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {searchQuery.trim() !== "" && searchResults.length > 6 && (
                <div className="flex-shrink-0 border-t bg-card/80 backdrop-blur-md p-2">
                  <Button variant="ghost" size="sm" onMouseDown={e => e.preventDefault()} onClick={() => setIsSearchExpanded(!isSearchExpanded)} className="w-full justify-center gap-2 rounded-lg hover:bg-primary/10 transition-all duration-300 active:scale-95">
                    {isSearchExpanded ? <><ChevronUp className="h-4 w-4" /> Show less</> : <><ChevronDown className="h-4 w-4" /> Show all results</>}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setIsDark(!isDark)} className="h-10 w-10 rounded-full transition-all duration-300 hover:bg-muted hover:scale-110 active:scale-90">
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full transition-all duration-300 hover:bg-muted hover:scale-110 active:scale-90">
                {user ? <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs uppercase shadow-sm border border-primary-foreground/20">{user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}</div> : <UserCircle2 className="h-5 w-5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-border/50 animate-in fade-in zoom-in-95 duration-200">
              {user ? (
                <div className="px-3 py-2.5 mb-1 bg-muted/50 rounded-xl"><p className="text-sm font-bold truncate">{user.displayName || "Account Synced"}</p><p className="text-xs text-muted-foreground truncate">{user.email}</p></div>
              ) : (
                <div className="px-2 py-2 mb-1"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cloud Sync</p><Button onClick={() => setShowAuthDialog(true)} className="w-full justify-start rounded-xl font-semibold transition-all active:scale-95" size="sm">Sign In / Register</Button></div>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowAboutDialog(true)} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium hover:bg-muted transition-all active:scale-95"><Info className="h-4 w-4 text-muted-foreground" /> About Ganvo</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowCreditsDialog(true)} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium hover:bg-muted transition-all active:scale-95"><Heart className="h-4 w-4 text-muted-foreground" /> Credits</DropdownMenuItem>
              {user && <><DropdownMenuSeparator /><DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium text-destructive hover:bg-destructive/10 transition-all active:scale-95"><LogOut className="h-4 w-4" /> Sign Out</DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0 bg-background relative transition-all duration-500">
        <div className="flex flex-1 flex-col overflow-y-auto min-h-0 z-10 pb-48 lg:pb-0 scroll-smooth">
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-6 md:px-8">
            {currentSong ? (
              <div className="flex w-full max-w-[480px] flex-col items-center animate-in fade-in zoom-in-95 duration-500 ease-[cubic-bezier(0.2,0,0,1)]">
                <div className="relative mb-8 w-full flex justify-center">
                  <div className={cn("h-64 w-64 md:h-[320px] md:w-[320px] overflow-hidden rounded-[2.5rem] relative transition-all duration-700 shadow-2xl", isPlaying && "scale-[1.02] shadow-[0_30px_60px_rgba(0,0,0,0.3)]", activeTab !== 'queue' && "hidden lg:block")}>
                    <img src={currentSong.thumbnail} alt="" className={cn("h-full w-full object-cover transition-transform duration-[3s] ease-out", isPlaying ? "scale-105" : "scale-100")} />
                    {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[2.5rem] bg-black/50 backdrop-blur-md animate-in fade-in"><Loader2 className="h-10 w-10 animate-spin text-white" /><span className="text-sm font-semibold text-white/90">Loading Stream...</span></div>}
                    {loadError && !isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[2.5rem] bg-black/70 p-6 text-center backdrop-blur-md animate-in fade-in zoom-in-95"><span className="text-sm font-medium text-white/90">{loadError}</span><Button size="sm" variant="secondary" onClick={handleRetryStream} className="mt-2 rounded-xl font-bold transition-transform active:scale-90">Retry Connection</Button></div>}
                    {isPlaying && !isLoading && !loadError && <div className="absolute bottom-5 left-5 flex items-center gap-1.5 rounded-full bg-black/60 px-4 py-2.5 backdrop-blur-md shadow-lg animate-in slide-in-from-bottom-4"><span className="eq-bar-1 h-3 w-0.5 rounded-full bg-white" /><span className="eq-bar-2 h-3 w-0.5 rounded-full bg-white" /><span className="eq-bar-3 h-3 w-0.5 rounded-full bg-white" /></div>}
                  </div>

                  {activeTab === 'lyrics' && (
                    <div className="lg:hidden w-full h-[45vh] min-h-[300px] bg-card/95 backdrop-blur-2xl rounded-[2.5rem] border shadow-2xl flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-500 relative z-20 overflow-hidden border-border/40">
                      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain"><div ref={lyricsContainerRefMobile} className="p-6">
                        {lyrics?.syncedLyrics ? (
                          <div className="space-y-4 py-8">{lyrics.syncedLyrics.map((line, idx) => (<p key={idx} className={cn("lyric-line transition-all duration-500 cursor-pointer rounded-2xl px-5 py-4 text-2xl font-bold leading-tight text-center active:scale-95", idx === currentLyricIndex ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground/30 scale-95")} onClick={() => { if (audioRef.current) audioRef.current.currentTime = line.time }}>{line.text}</p>))}</div>
                        ) : lyrics?.plainLyrics ? (<p className="whitespace-pre-wrap leading-relaxed text-muted-foreground text-center font-bold text-xl py-8 animate-in fade-in">{lyrics.plainLyrics}</p>) 
                        : (<div className="flex flex-col items-center justify-center py-20 text-center h-full"><Mic2 className="h-10 w-10 text-muted-foreground/50 mb-5" /><p className="font-bold text-xl">No synchronized lyrics</p></div>)}
                      </div></div>
                    </div>
                  )}

                  {activeTab === 'library' && (
                    <div className="lg:hidden w-full h-[45vh] min-h-[300px] bg-card/95 backdrop-blur-2xl rounded-[2.5rem] border shadow-2xl flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-500 relative z-20 overflow-hidden border-border/40">
                      <div className="p-4 border-b bg-muted/20 flex items-center justify-between"><h3 className="font-bold text-lg flex items-center gap-2"><Library className="h-5 w-5 text-primary"/> Your Library</h3>{!user && <span className="text-[10px] font-black bg-destructive/10 text-destructive px-2.5 py-0.5 rounded-full uppercase tracking-tighter">Local Only</span>}</div>
                      <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain"><div className="p-3 space-y-2">
                        {savedSongs.length > 0 ? savedSongs.map((song, idx) => (
                          <div key={idx} className="flex items-center gap-3 rounded-xl p-2.5 bg-muted/30 hover:bg-muted transition-all duration-300 active:scale-[0.98]">
                            <button onClick={() => playFromLibrary(song)} className="flex flex-1 items-center gap-3 text-left"><img src={song.thumbnail} className="h-12 w-12 rounded-lg object-cover shadow-sm" alt="" /><div className="flex-1 overflow-hidden"><p className="truncate text-sm font-bold">{song.title}</p><p className="truncate text-xs font-medium text-muted-foreground">{song.artist}</p></div></button>
                            <Button variant="ghost" size="icon" onClick={() => toggleLike(song)} className="h-8 w-8 text-red-500 hover:bg-red-500/10 transition-transform active:scale-75"><Heart className="h-4 w-4 fill-current" /></Button>
                          </div>
                        )) : (<div className="flex flex-col items-center justify-center py-20 animate-in zoom-in duration-500"><Heart className="h-12 w-12 text-muted-foreground/30 mb-4" /><p className="font-bold text-lg">Your Library is empty</p></div>)}
                      </div></div>
                    </div>
                  )}
                </div>

                <div className="mb-8 flex w-full items-center gap-4 px-2 transition-all">
                  <div className="flex-1 overflow-hidden text-center"><h2 className="mb-1 truncate text-2xl font-black tracking-tight sm:text-3xl leading-tight">{currentSong.title}</h2><p className="truncate text-base font-bold text-muted-foreground/80">{currentSong.artist}</p></div>
                  <Button variant="ghost" size="icon" onClick={() => toggleLike(currentSong)} className={cn("h-12 w-12 rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-75", likedSongs.has(currentSong.videoId) && "text-red-500 hover:bg-red-500/10")}><Heart className={cn("h-6 w-6 transition-all duration-500", likedSongs.has(currentSong.videoId) && "fill-current scale-110 drop-shadow-md")} /></Button>
                </div>

                <div className="mb-8 w-full px-2">
                  <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="mb-3 cursor-grab active:cursor-grabbing [&_[data-slot=range]]:bg-primary [&_[data-slot=thumb]]:h-4 [&_[data-slot=thumb]]:w-4 [&_[data-slot=thumb]]:border-2 [&_[data-slot=thumb]]:hover:scale-150 [&_[data-slot=track]]:h-2 transition-all" />
                  <div className="flex justify-between text-xs font-black tabular-nums text-muted-foreground/70 transition-colors"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
                </div>

                <div className="mb-8 flex items-center justify-center gap-4 sm:gap-7 w-full transition-all">
                  <Button variant="ghost" size="icon" onClick={() => setShuffle(!shuffle)} className={cn("h-12 w-12 rounded-full transition-all duration-300", shuffle ? "bg-primary/15 text-primary" : "text-muted-foreground")}><Shuffle className="h-5 w-5" /></Button>
                  <Button variant="ghost" size="icon" onClick={playPrevious} className="h-14 w-14 rounded-full flex items-center justify-center hover:bg-muted transition-all active:scale-75"><SkipBack className="h-7 w-7 fill-current text-foreground" /></Button>
                  <Button onClick={togglePlay} disabled={isLoading || !audioUrl} className={cn("h-16 w-16 sm:h-20 sm:w-20 rounded-[2.5rem] bg-primary text-primary-foreground shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] hover:scale-110 active:scale-90 flex items-center justify-center", isPlaying && "scale-105")}>
                    {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : isPlaying ? <Pause className="h-7 w-7 sm:h-9 sm:w-9 fill-current" /> : <Play className="h-7 w-7 sm:h-9 sm:w-9 fill-current translate-x-[2px]" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={playNext} className="h-14 w-14 rounded-full flex items-center justify-center hover:bg-muted transition-all active:scale-75"><SkipForward className="h-7 w-7 fill-current text-foreground" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")} className={cn("h-12 w-12 rounded-full transition-all duration-300", repeatMode !== "off" ? "bg-primary/15 text-primary" : "text-muted-foreground")}>{repeatMode === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}</Button>
                </div>

                <div className="flex w-full items-center justify-between gap-3 px-2">
                  <div className="flex flex-1 items-center gap-3 rounded-2xl bg-muted/60 backdrop-blur-sm px-4 py-3.5 hover:bg-muted/80 transition-all shadow-sm">
                    <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8 p-0 transition-transform hover:scale-110 active:scale-90 flex items-center justify-center"><VolumeIcon className="h-5 w-5" /></Button>
                    <Slider value={[isMuted ? 0 : volume]} max={100} step={1} onValueChange={handleVolumeChange} className="flex-1 [&_[data-slot=thumb]]:h-4 [&_[data-slot=thumb]]:w-4" />
                    <span className="w-9 text-right text-xs font-black tabular-nums text-muted-foreground">{isMuted ? 0 : volume}%</span>
                  </div>
                  <div className="flex lg:hidden bg-muted/60 backdrop-blur-sm rounded-2xl p-1 gap-1 border border-border/40"><Button variant={activeTab === 'lyrics' ? 'default' : 'ghost'} size="icon" onClick={() => setActiveTab(activeTab === 'lyrics' ? 'queue' : 'lyrics')} className="h-11 w-11 rounded-xl transition-all active:scale-90 flex items-center justify-center"><Mic2 className="h-5 w-5" /></Button><Button variant={activeTab === 'library' ? 'default' : 'ghost'} size="icon" onClick={() => setActiveTab(activeTab === 'library' ? 'queue' : 'library')} className="h-11 w-11 rounded-xl transition-all active:scale-90 flex items-center justify-center"><Library className="h-5 w-5" /></Button></div>
                </div>
                
                {/* Mobile Bottom Padding Guarantee */}
                <div className="h-40 shrink-0 lg:hidden w-full pointer-events-none" />
              </div>
            ) : (
              <div className="flex flex-col items-center px-4 text-center animate-in fade-in zoom-in-95 duration-1000 ease-[cubic-bezier(0.2,0,0,1)]">
                <div className="mb-8 flex h-40 w-40 items-center justify-center rounded-[3rem] bg-muted/50 shadow-inner transition-transform duration-700 hover:rotate-6"><Music2 className="h-20 w-20 text-muted-foreground/30" /></div>
                <h2 className="mb-3 text-3xl font-black tracking-tight leading-tight">Start Listening</h2><p className="max-w-xs text-base font-bold text-muted-foreground/70 leading-relaxed px-4">Search for your favorite tracks or artists to begin your session.</p>
              </div>
            )}
          </div>
        </div>

        <div className="hidden w-80 flex-col border-l border-border/40 bg-card/40 backdrop-blur-3xl lg:flex xl:w-[420px] overflow-hidden min-h-0 shadow-2xl z-20 transition-all duration-500">
          <div className="flex p-3 gap-2 bg-muted/10 border-b border-border/40 transition-colors">
            <button onClick={() => setActiveTab('queue')} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all duration-500 active:scale-95", activeTab === 'queue' ? "bg-background shadow-md text-foreground" : "text-muted-foreground hover:bg-muted/50")}><ListMusic className="h-4 w-4" /> Queue <span className="bg-muted px-1.5 py-0.5 rounded-md text-[10px] font-black">{queue.length}</span></button>
            <button onClick={() => setActiveTab('lyrics')} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all duration-500 active:scale-95", activeTab === 'lyrics' ? "bg-background shadow-md text-foreground" : "text-muted-foreground hover:bg-muted/50")}><Mic2 className="h-4 w-4" /> Lyrics</button>
            <button onClick={() => setActiveTab('library')} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all duration-500 active:scale-95", activeTab === 'library' ? "bg-background shadow-md text-foreground" : "text-muted-foreground hover:bg-muted/50")}><Library className="h-4 w-4" /> Library</button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain transition-all duration-500 scroll-smooth">
            {activeTab === 'lyrics' ? (
              <div ref={lyricsContainerRef} className="p-6">
                {lyrics?.syncedLyrics ? (<div className="space-y-6 pb-40">{lyrics.syncedLyrics.map((line, idx) => (<p key={idx} className={cn("lyric-line transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)] cursor-pointer rounded-2xl px-6 py-4 text-2xl font-black leading-tight active:scale-[0.98]", idx === currentLyricIndex ? "bg-primary/10 text-primary shadow-sm scale-105" : "text-muted-foreground/30 scale-95")} onClick={() => { if (audioRef.current) audioRef.current.currentTime = line.time }}>{line.text}</p>))}</div>) 
                : lyrics?.plainLyrics ? (<p className="whitespace-pre-wrap leading-relaxed text-muted-foreground font-bold text-xl py-12 animate-in fade-in pb-40">{lyrics.plainLyrics}</p>) 
                : (<div className="flex flex-col items-center justify-center py-32 text-center pb-40 h-full animate-in zoom-in duration-700"><Mic2 className="h-12 w-12 text-muted-foreground/20 mb-6" /><p className="font-black text-xl opacity-40">No Lyrics Found</p></div>)}
              </div>
            ) : activeTab === 'library' ? (
               <div className="p-4 space-y-2 pb-40">
                  <div className="mb-4 px-2 flex items-center justify-between"><h3 className="font-black text-xl tracking-tight">Saved Songs</h3>{!user && <span className="text-[10px] font-black bg-destructive/10 text-destructive px-3 py-1 rounded-full border border-destructive/20 shadow-sm">LOCAL MODE</span>}</div>
                  {savedSongs.length > 0 ? savedSongs.map((song, idx) => (
                    <div key={idx} className="group flex items-center gap-4 rounded-2xl p-2.5 hover:bg-muted/80 transition-all duration-300 active:scale-[0.98]">
                      <button onClick={() => playFromLibrary(song)} className="flex flex-1 items-center gap-4 text-left outline-none"><img src={song.thumbnail} alt="" className="h-14 w-14 rounded-2xl object-cover shadow-md transition-all duration-500 group-hover:scale-105 group-hover:shadow-lg" /><div className="flex-1 overflow-hidden"><p className="truncate text-sm font-bold leading-tight">{song.title}</p><p className="truncate text-xs font-bold text-muted-foreground mt-1 opacity-70">{song.artist}</p></div></button>
                      <Button variant="ghost" size="icon" onClick={() => toggleLike(song)} className="h-10 w-10 text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-transform active:scale-75"><Heart className="h-5 w-5 fill-current" /></Button>
                    </div>
                  )) : (<div className="flex flex-col items-center justify-center py-32 text-center pb-40 h-full animate-in zoom-in duration-700"><Heart className="h-12 w-12 text-muted-foreground/20 mb-6" /><p className="font-black text-xl opacity-40">Library Empty</p></div>)}
               </div>
            ) : (
              <div className="p-3 space-y-2 pb-40">
                {queue.length > 0 ? queue.map((song, idx) => (
                  <div key={idx} className={cn("group flex items-center gap-4 rounded-2xl p-2.5 transition-all duration-300 hover:bg-muted/80 active:scale-[0.98]", idx === currentIndex ? "bg-primary/5 border border-primary/20 shadow-sm" : "border border-transparent")}>
                    <button onClick={() => setCurrentIndex(idx)} className="flex flex-1 items-center gap-4 text-left outline-none"><div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl shadow-md transition-all group-hover:shadow-lg"><img src={song.thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />{idx === currentIndex && isPlaying && <div className="absolute inset-0 flex items-center justify-center gap-0.5 bg-black/50 backdrop-blur-[2px] animate-in fade-in"><span className="eq-bar-1 h-3 w-0.5 rounded-full bg-white" /><span className="eq-bar-2 h-3 w-0.5 rounded-full bg-white" /></div>}</div><div className="flex-1 overflow-hidden"><p className={cn("truncate text-sm font-black transition-colors", idx === currentIndex ? "text-primary" : "text-foreground")}>{song.title}</p><p className="truncate text-xs font-bold text-muted-foreground mt-1 opacity-70 transition-colors">{song.artist}</p></div></button>
                    <span className="text-xs font-black tabular-nums text-muted-foreground/50 mr-1">{formatTime(song.duration)}</span>
                    <Button variant="ghost" size="icon" onClick={() => removeFromQueue(idx)} className="h-10 w-10 flex items-center justify-center rounded-full opacity-0 transition-all duration-300 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive active:scale-75"><X className="h-4 w-4" /></Button>
                  </div>
                )) : (<div className="flex flex-col items-center justify-center py-32 text-center pb-40 h-full animate-in zoom-in duration-700"><ListMusic className="h-12 w-12 text-muted-foreground/20 mb-6" /><p className="font-black text-xl opacity-40">Queue Empty</p></div>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {currentSong && (
        <div className={cn("fixed bottom-4 left-4 right-4 z-50 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] lg:hidden", activeTab !== 'queue' ? "translate-y-32 opacity-0 pointer-events-none" : "translate-y-0 opacity-100")}>
          <div className="flex items-center gap-3 rounded-[2.5rem] bg-card/95 p-3 backdrop-blur-2xl border border-border/50 shadow-2xl transition-all duration-500 hover:shadow-primary/10">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-[1.5rem] shadow-lg transition-transform active:scale-95"><img src={currentSong.thumbnail} alt="" className={cn("h-full w-full object-cover transition-transform duration-1000", isPlaying ? "scale-110" : "scale-100")} /></div>
            <div className="flex-1 overflow-hidden flex flex-col justify-center px-1"><p className="truncate text-sm font-black leading-tight tracking-tight">{currentSong.title}</p><p className="truncate text-xs font-bold text-muted-foreground mt-1 opacity-70">{currentSong.artist}</p></div>
            <Button onClick={() => toggleLike(currentSong)} variant="ghost" size="icon" className={cn("h-12 w-12 rounded-full flex items-center justify-center transition-all duration-300 active:scale-75", likedSongs.has(currentSong.videoId) && "text-red-500")}><Heart className={cn("h-5 w-5 transition-all duration-500", likedSongs.has(currentSong.videoId) && "fill-current scale-110")} /></Button>
            <Button onClick={togglePlay} disabled={isLoading || !audioUrl} className={cn("h-14 w-14 flex-shrink-0 flex items-center justify-center rounded-[1.75rem] shadow-xl transition-all duration-300 active:scale-90", isPlaying ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>{isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current translate-x-[1px]" />}</Button>
          </div>
        </div>
      )}

      {/* Auth / Cloud Registration Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-8 border-0 shadow-2xl outline-none focus:outline-none focus:ring-0 animate-in zoom-in-95 duration-500 ease-[cubic-bezier(0.2,0,0,1)]">
          <DialogHeader>
            <div className="mb-6 flex justify-center"><div className="flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-primary/10 text-primary transition-transform duration-700 hover:scale-110 hover:rotate-6 shadow-inner"><UserCircle2 className="h-12 w-12" /></div></div>
            <DialogTitle className="text-3xl font-black text-center tracking-tight leading-tight">Ganvo Account</DialogTitle>
            <DialogDescription className="font-bold text-center mt-2 opacity-70 leading-relaxed">{isSignUp ? "Register to save your personal library to the cloud." : "Welcome back. Sign in to sync your saved songs."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEmailAuth} className="space-y-4 mt-4">
            <div className="space-y-3">
              <Input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required className="h-14 rounded-2xl bg-muted/50 border-transparent focus-visible:ring-primary font-bold px-6 text-base" />
              <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="h-14 rounded-2xl bg-muted/50 border-transparent focus-visible:ring-primary font-bold px-6 text-base" />
            </div>
            {authError && <p className="text-xs font-black text-destructive text-center animate-in slide-in-from-top-2">{authError}</p>}
            <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl transition-all duration-300 hover:shadow-2xl active:scale-[0.98]">{isSignUp ? "Create Account" : "Sign In"}</Button>
            <div className="flex items-center gap-3 my-4"><div className="flex-1 h-px bg-border/60"></div><span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Social</span><div className="flex-1 h-px bg-border/60"></div></div>
            <Button type="button" variant="outline" onClick={handleGoogleSignIn} className="w-full h-14 rounded-2xl font-bold text-base transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-3 border-border/60 hover:bg-muted shadow-sm">Continue with Google</Button>
            <p className="text-sm text-center font-bold text-muted-foreground mt-6 cursor-pointer hover:text-primary transition-colors underline decoration-dotted underline-offset-4" onClick={() => {setIsSignUp(!isSignUp); setAuthError("")}}>{isSignUp ? "Already a member? Log in" : "New? Create an account"}</p>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-8 border-0 shadow-2xl outline-none focus:outline-none focus:ring-0 animate-in zoom-in-95 duration-500">
          <DialogHeader>
            <div className="mb-6 flex items-center gap-5 transition-transform duration-500 hover:translate-x-2"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/20 transition-transform duration-500 hover:rotate-12"><Music2 className="h-8 w-8 text-primary-foreground" /></div><div><DialogTitle className="text-3xl font-black tracking-tighter leading-none">Ganvo Music</DialogTitle><DialogDescription className="font-black mt-2 opacity-60 text-sm">V 1.0.0 Expressive</DialogDescription></div></div>
          </DialogHeader>
          <div className="space-y-4 text-base font-bold text-muted-foreground leading-relaxed mt-2"><p>A high-performance player with cloud synchronization, maximized resolution thumbnails, and native-feel animations.</p><div className="flex flex-wrap items-center gap-2 pt-6"><span className="rounded-xl bg-secondary px-4 py-2 text-xs font-black text-secondary-foreground shadow-sm transition-transform hover:scale-105">YT-MUSIC API</span><span className="rounded-xl bg-secondary px-4 py-2 text-xs font-black text-secondary-foreground shadow-sm transition-transform hover:scale-105">LRCLIB CLOUD</span></div></div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreditsDialog} onOpenChange={setShowCreditsDialog}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-8 border-0 shadow-2xl outline-none focus:outline-none focus:ring-0 animate-in zoom-in-95 duration-500">
          <DialogHeader><DialogTitle className="flex items-center gap-4 text-3xl font-black tracking-tighter leading-none"><Heart className="h-8 w-8 text-red-500 fill-current animate-pulse" /> Credits</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-6">
            <div className="rounded-[2rem] bg-muted/40 p-6 transition-all hover:scale-[1.02] border border-transparent hover:border-border/50 shadow-inner"><h4 className="mb-2 font-black text-base text-foreground uppercase tracking-wider text-[11px]">Inspiration</h4><a href="https://github.com/koiverse/ArchiveTune" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-lg font-black text-primary hover:underline group transition-all">ArchiveTune <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /></a><p className="mt-2 text-xs font-bold text-muted-foreground/60">Android Material 3 Music Client</p></div>
            <div className="rounded-[2rem] bg-muted/40 p-6 transition-all hover:scale-[1.02] border border-transparent hover:border-border/50 shadow-inner"><h4 className="mb-3 font-black text-base text-foreground uppercase tracking-wider text-[11px]">System Power</h4><ul className="space-y-3 text-sm font-black text-muted-foreground/80"><li className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-blue-500 shadow-sm" /> YouTube Engine</li><li className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-green-500 shadow-sm" /> LrcLib Provider</li><li className="flex items-center gap-3"><span className="h-3 w-3 rounded-full bg-yellow-500 shadow-sm" /> Multi-Proxy Stream</li></ul></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
