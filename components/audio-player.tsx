"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { initializeApp, getApps, getApp } from "firebase/app"
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser 
} from "firebase/auth"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1, Search, Shuffle, 
  Repeat, Repeat1, Sun, Moon, Loader2, Music2, X, ListMusic, Mic2, MoreVertical, 
  Info, Heart, ChevronDown, ChevronUp, ExternalLink, History, Library, UserCircle2, LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

const firebaseConfig = {
  apiKey: "AIzaSyBI-ABs1S7Ln2jJ7xYxgUZwU1nEXZmqI2c",
  authDomain: "ganvotesting.firebaseapp.com",
  projectId: "ganvotesting",
  storageBucket: "ganvotesting.firebasestorage.app",
  messagingSenderId: "1083596663051",
  appId: "1:1083596663051:web:52900f44e84034b7421a0e"
};

interface Song { videoId: string; title: string; artist: string; album: string; duration: number; thumbnail: string; }
interface LyricLine { time: number; text: string; }
interface LyricsData { syncedLyrics: LyricLine[] | null; plainLyrics: string | null; }

export function AudioPlayer() {
  const [mounted, setMounted] = useState(false)
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

  // Fix 1: Mount check to prevent Vercel Prerender/SSR Errors
  useEffect(() => {
    setMounted(true)
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

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
          setSavedSongs(parsed); setLikedSongs(new Set(parsed.map((s: Song) => s.videoId)))
        }
      }
    })

    try {
      const history = localStorage.getItem('ganvo_search_history')
      if (history) setSearchHistory(JSON.parse(history))
    } catch (e) {}

    return () => unsubscribe()
  }, [])

  const saveSearch = (query: string) => {
    if (!query.trim()) return
    const newHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, 15)
    setSearchHistory(newHistory); localStorage.setItem('ganvo_search_history', JSON.stringify(newHistory))
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError("")
    const auth = getAuth()
    try {
      if (isSignUp) await createUserWithEmailAndPassword(auth, email, password)
      else await signInWithEmailAndPassword(auth, email, password)
      setShowAuthDialog(false); setEmail(""); setPassword("")
    } catch (error: any) { setAuthError(error.message.replace("Firebase: ", "")) }
  }

  const handleGoogleSignIn = async () => {
    const auth = getAuth(); const provider = new GoogleAuthProvider()
    try { await signInWithPopup(auth, provider); setShowAuthDialog(false) } 
    catch (error: any) { setAuthError(error.message.replace("Firebase: ", "")) }
  }

  const handleSignOut = async () => { await signOut(getAuth()) }

  useEffect(() => { document.documentElement.classList.toggle("dark", isDark) }, [isDark])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!searchQuery.trim()) { setSearchResults([]); setIsSearching(false); return }
    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()
        setSearchResults(data.results || [])
      } catch (error) { console.error(error) } finally { setIsSearching(false) }
    }, 300)
  }, [searchQuery])

  const addToQueueAndPlay = async (song: Song) => {
    saveSearch(searchQuery || song.title)
    const existingIndex = queue.findIndex((s) => s.videoId === song.videoId)
    if (existingIndex >= 0) setCurrentIndex(existingIndex)
    else { setQueue((prev) => [...prev, song]); setCurrentIndex(queue.length) }
    setSearchResults([]); setSearchQuery(""); setIsSearchExpanded(false); setSearchFocused(false)
  }

  useEffect(() => {
    if (!currentSong) return
    const loadStream = async () => {
      setIsLoading(true); setAudioUrl(null); setLoadError(null)
      try {
        const res = await fetch(`/api/music/stream/${currentSong.videoId}`)
        const data = await res.json()
        if (data.audioUrl) setAudioUrl(data.audioUrl)
        else setLoadError(data.error || "Stream unavailable")
      } catch (e) { setLoadError("Connection error") } finally { setIsLoading(false) }
    }
    loadStream()
  }, [currentSong?.videoId])

  useEffect(() => {
    if (!currentSong) return
    const loadLyrics = async () => {
      setLyrics(null); setCurrentLyricIndex(-1)
      try {
        const params = new URLSearchParams({ track: currentSong.title, artist: currentSong.artist })
        const res = await fetch(`/api/lyrics?${params}`); const data = await res.json()
        if (data.syncedLyrics || data.plainLyrics) setLyrics({ syncedLyrics: data.syncedLyrics, plainLyrics: data.plainLyrics })
      } catch (e) {}
    }
    loadLyrics()
  }, [currentSong?.videoId])

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl; audioRef.current.load()
      audioRef.current.play().then(() => setIsPlaying(true)).catch(e => { if (e.name !== 'AbortError') setLoadError("Playback failed") })
    }
  }, [audioUrl])

  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime) }
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration) }
  const handleEnded = () => { playNext() }

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play().catch(e => e.name !== 'AbortError' && console.error(e))
    setIsPlaying(!isPlaying)
  }, [isPlaying, audioUrl])

  const playNext = useCallback(() => {
    if (queue.length === 0) return
    setCurrentIndex((currentIndex + 1) % queue.length)
  }, [queue.length, currentIndex])

  const playPrevious = useCallback(() => {
    if (queue.length === 0) return
    if (currentTime > 3) { if (audioRef.current) audioRef.current.currentTime = 0; return }
    setCurrentIndex((currentIndex - 1 + queue.length) % queue.length)
  }, [queue.length, currentIndex, currentTime])

  const handleSeek = (value: number[]) => { if (audioRef.current) { audioRef.current.currentTime = value[0]; setCurrentTime(value[0]) } }
  const handleVolumeChange = (value: number[]) => { 
    setVolume(value[0]); if (audioRef.current) audioRef.current.volume = value[0] / 100 
  }

  const toggleLike = async (song: Song) => {
    const db = getFirestore()
    setLikedSongs((prev) => {
      const next = new Set(prev); let newSaved = [...savedSongs]
      if (next.has(song.videoId)) { next.delete(song.videoId); newSaved = newSaved.filter(s => s.videoId !== song.videoId) } 
      else { next.add(song.videoId); newSaved.unshift(song) }
      setSavedSongs(newSaved)
      if (user) setDoc(doc(db, "users", user.uid), { savedSongs: newSaved }, { merge: true })
      else localStorage.setItem('ganvo_saved_songs', JSON.stringify(newSaved))
      return next
    })
  }

  const handleRetryStream = async () => {
    if (!currentSong) return; setLoadError(null); setIsLoading(true)
    try {
      const res = await fetch(`/api/music/stream/${currentSong.videoId}`); const data = await res.json()
      if (data.audioUrl && audioRef.current) {
        setAudioUrl(data.audioUrl); audioRef.current.src = data.audioUrl; audioRef.current.load();
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setLoadError("Retry failed"))
      }
    } catch (e) { setLoadError("Network error") } finally { setIsLoading(false) }
  };

  const formatTime = (s: number) => { if (!isFinite(s)) return "0:00"; const m = Math.floor(s/60), sec = Math.floor(s%60); return `${m}:${sec.toString().padStart(2, "0")}` }
  
  // Build-safe return
  if (!mounted) return <div className="h-screen bg-background" />

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background transition-colors duration-500">
      <header className="elevation-1 z-40 flex h-16 flex-shrink-0 items-center justify-between px-3 md:px-6 relative bg-background/90 backdrop-blur-xl border-b border-border/40">
        <div className={cn("flex items-center gap-3 shrink-0 transition-all duration-300", searchFocused && "hidden md:flex")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground shadow-lg transition-transform duration-500 hover:scale-110">
            <Music2 className="h-5 w-5 text-background" />
          </div>
          <div className="hidden sm:flex items-baseline gap-1"><span className="text-xl font-normal text-muted-foreground">Ganvo</span><span className="text-xl font-bold">Music</span></div>
        </div>

        <div ref={searchContainerRef} className="relative flex-1 max-w-2xl mx-auto w-full">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
            <Input
              type="text" placeholder="Search songs..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => setSearchFocused(true)}
              className={cn("h-11 md:h-12 w-full rounded-full border-0 bg-muted/80 pl-12 pr-12 text-base transition-all duration-500", searchFocused && "bg-card shadow-xl ring-2 ring-primary scale-[1.01]")}
            />
          </div>
          {searchFocused && (
            <div className="absolute left-0 right-0 top-full z-[60] mt-3 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-300">
              <ScrollArea className={cn("flex-1 transition-all", isSearchExpanded ? "h-[70vh]" : "h-[400px]")}>
                <div className="p-2">
                  {searchQuery === "" ? searchHistory.map((h, i) => (<button key={i} onMouseDown={e => e.preventDefault()} onClick={() => setSearchQuery(h)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted"><History className="h-4 w-4 opacity-70" />{h}</button>)) :
                  searchResults.map((s, i) => (<button key={i} onClick={() => addToQueueAndPlay(s)} className="flex w-full items-center gap-4 rounded-xl p-3 text-left hover:bg-secondary/60"><img src={s.thumbnail} className="h-12 w-12 rounded-lg object-cover" /><div className="flex-1 overflow-hidden"><p className="truncate font-medium">{s.title}</p><p className="truncate text-sm opacity-70">{s.artist}</p></div></button>))}
                </div>
              </ScrollArea>
              {searchResults.length > 6 && (
                <div className="p-2 border-t"><Button variant="ghost" className="w-full" onMouseDown={e => e.preventDefault()} onClick={() => setIsSearchExpanded(!isSearchExpanded)}>{isSearchExpanded ? "Show Less" : "Show All"}</Button></div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setIsDark(!isDark)} className="h-10 w-10 rounded-full">{isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</Button>
          <Button variant="ghost" size="icon" onClick={() => user ? handleSignOut() : setShowAuthDialog(true)} className="h-10 w-10 rounded-full">{user ? <LogOut className="h-5 w-5" /> : <UserCircle2 className="h-5 w-5" />}</Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        <div className="flex flex-1 flex-col overflow-y-auto min-h-0 z-10 pb-48 lg:pb-0 scroll-smooth">
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
            {currentSong ? (
              <div className="flex w-full max-w-[480px] flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                <div className={cn("h-64 w-64 md:h-[320px] md:w-[320px] overflow-hidden rounded-[2.5rem] relative shadow-2xl transition-all", isPlaying && "scale-[1.02]", activeTab !== 'queue' && "hidden lg:block")}>
                  <img src={currentSong.thumbnail} className="h-full w-full object-cover" alt="" />
                  {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"><Loader2 className="animate-spin text-white h-10 w-10" /></div>}
                  {loadError && <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-black/60 backdrop-blur-md"><span className="text-white mb-2">{loadError}</span><Button size="sm" onClick={handleRetryStream}>Retry</Button></div>}
                </div>

                <div className="my-8 w-full text-center"><h2 className="text-2xl font-black truncate">{currentSong.title}</h2><p className="text-muted-foreground font-bold">{currentSong.artist}</p></div>
                
                <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={handleSeek} className="mb-8 w-full" />

                <div className="mb-8 flex items-center justify-center gap-6 w-full">
                  <Button variant="ghost" onClick={playPrevious} className="h-14 w-14 rounded-full flex items-center justify-center"><SkipBack className="h-8 w-8 fill-current" /></Button>
                  <Button onClick={togglePlay} disabled={isLoading || !audioUrl} className="h-20 w-20 rounded-[2.2rem] bg-primary text-primary-foreground shadow-2xl flex items-center justify-center transition-all active:scale-90">
                    {isPlaying ? <Pause className="h-10 w-10 fill-current" /> : <Play className="h-10 w-10 fill-current translate-x-[3px]" />}
                  </Button>
                  <Button variant="ghost" onClick={playNext} className="h-14 w-14 rounded-full flex items-center justify-center"><SkipForward className="h-8 w-8 fill-current" /></Button>
                </div>

                <div className="flex w-full items-center justify-between gap-3 bg-muted/40 p-4 rounded-3xl">
                   <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)} className="flex items-center justify-center"><Volume2 className="h-6 w-6" /></Button>
                   <Slider value={[isMuted ? 0 : volume]} max={100} onValueChange={handleVolumeChange} className="flex-1" />
                   <Button variant="ghost" size="icon" onClick={() => setActiveTab(activeTab === 'lyrics' ? 'queue' : 'lyrics')} className="flex items-center justify-center lg:hidden"><Mic2 className="h-6 w-6" /></Button>
                </div>
                {/* Mobile Spacer Guarantee */}
                <div className="h-24 lg:hidden" />
              </div>
            ) : (
              <div className="text-center opacity-40"><Music2 className="h-24 w-24 mx-auto mb-4" /><h2 className="text-2xl font-black">Ganvo Music</h2></div>
            )}
          </div>
        </div>
      </div>

      {currentSong && (
        <div className={cn("fixed bottom-4 left-4 right-4 z-50 transition-all duration-700 lg:hidden", activeTab !== 'queue' ? "translate-y-32 opacity-0" : "translate-y-0 opacity-100")}>
          <div className="flex items-center gap-3 rounded-[2.5rem] bg-card/95 p-3 backdrop-blur-2xl border shadow-2xl">
            <img src={currentSong.thumbnail} className="h-14 w-14 rounded-2xl object-cover" alt="" />
            <div className="flex-1 overflow-hidden"><p className="truncate font-black text-sm">{currentSong.title}</p></div>
            <Button onClick={() => toggleLike(currentSong)} variant="ghost" size="icon" className="flex items-center justify-center"><Heart className={cn("h-6 w-6", likedSongs.has(currentSong.videoId) && "fill-current text-red-500")} /></Button>
            <Button onClick={togglePlay} className="h-14 w-14 rounded-[1.5rem] bg-primary text-white flex items-center justify-center">{isPlaying ? <Pause /> : <Play className="translate-x-[1px]" />}</Button>
          </div>
        </div>
      )}

      {/* Simplified Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="rounded-[2.5rem] p-8 border-0 shadow-2xl outline-none focus:outline-none focus:ring-0">
          <DialogHeader><DialogTitle className="text-center font-black text-2xl">Ganvo Sync</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-6">
            <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="h-14 rounded-2xl" />
            <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="h-14 rounded-2xl" />
            {authError && <p className="text-xs text-red-500 text-center font-bold">{authError}</p>}
            <Button onClick={handleEmailAuth} className="w-full h-14 rounded-2xl font-black">{isSignUp ? "Sign Up" : "Log In"}</Button>
            <Button variant="outline" onClick={handleGoogleSignIn} className="w-full h-14 rounded-2xl border-2">Continue with Google</Button>
            <p className="text-center text-sm font-bold opacity-60 cursor-pointer" onClick={() => setIsSignUp(!isSignUp)}>{isSignUp ? "Have an account? Login" : "No account? Register"}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
