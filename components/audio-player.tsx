"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { initializeApp, getApps } from "firebase/app"
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth"
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore"
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
} from "@/components/ui/dialog"
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1, Search, Shuffle,
  Repeat, Repeat1, Sun, Moon, Loader2, Music2, X, ListMusic, Mic2, MoreVertical,
  Info, Heart, ChevronDown, ChevronUp, ExternalLink, History, Library, UserCircle2, LogOut
} from "lucide-react"
import { cn } from "@/lib/utils"

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBI-ABs1S7Ln2jJ7xYxgUZwU1nEXZmqI2c",
  authDomain: "ganvotesting.firebaseapp.com",
  projectId: "ganvotesting",
  storageBucket: "ganvotesting.firebasestorage.app",
  messagingSenderId: "1083596663051",
  appId: "1:1083596663051:web:52900f44e84034b7421a0e"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export function AudioPlayer() {
  const [isDark, setIsDark] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])
  const [queue, setQueue] = useState<any[]>([])
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
  const [lyrics, setLyrics] = useState<any>(null)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [activeTab, setActiveTab] = useState<'queue' | 'lyrics' | 'library'>('queue')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
  const [savedSongs, setSavedSongs] = useState<any[]>([])
  const [searchFocused, setSearchFocused] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const currentSong = queue[currentIndex]

  // FIREBASE: Handle User Auth and Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, "users", u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSavedSongs(data.savedSongs || []);
          setLikedSongs(new Set(data.likedSongs || []));
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const syncToCloud = async (songs: any[], ids: string[]) => {
    if (user) {
      await setDoc(doc(db, "users", user.uid), { savedSongs: songs, likedSongs: ids }, { merge: true });
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setShowAuthDialog(false);
    } catch (e) { console.error(e) }
  };

  const handleLogout = () => signOut(auth);

  // APP LOGIC
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])

  useEffect(() => {
    const hist = localStorage.getItem('ganvo_history')
    if (hist) setSearchHistory(JSON.parse(hist))
  }, [])

  const saveSearch = (q: string) => {
    if (!q.trim()) return
    const newHist = [q, ...searchHistory.filter(x => x !== q)].slice(0, 10)
    setSearchHistory(newHist)
    localStorage.setItem('ganvo_history', JSON.stringify(newHist))
  }

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setIsSearching(false); return }
    setIsSearching(true)
    const delay = setTimeout(async () => {
      try {
        const res = await fetch(`/api/music/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults(data.results || [])
      } finally { setIsSearching(false) }
    }, 400)
    return () => clearTimeout(delay)
  }, [searchQuery])

  const addToQueueAndPlay = async (song: any) => {
    saveSearch(searchQuery || song.title)
    const idx = queue.findIndex(s => s.videoId === song.videoId)
    if (idx >= 0) setCurrentIndex(idx)
    else { setQueue(p => [...p, song]); setCurrentIndex(queue.length) }
    setSearchFocused(false); setIsSearchExpanded(false); setSearchQuery("")
  }

  // FORCE RETRY STREAMING (Fixes the pause timeout error)
  const handleLoadStream = async () => {
    if (!currentSong) return
    setIsLoading(true); setLoadError(null); setAudioUrl(null)
    try {
      const res = await fetch(`/api/music/stream/${currentSong.videoId}`)
      const data = await res.json()
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl)
        if (audioRef.current) {
          audioRef.current.src = data.audioUrl
          audioRef.current.load()
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
        }
      } else { setLoadError("Could not find stream.") }
    } catch (e) { setLoadError("Network Error.") }
    finally { setIsLoading(false) }
  }

  useEffect(() => { handleLoadStream() }, [currentSong?.videoId])

  const toggleLike = (song: any) => {
    const next = new Set(likedSongs)
    let nextSaved = [...savedSongs]
    if (next.has(song.videoId)) {
      next.delete(song.videoId)
      nextSaved = nextSaved.filter(s => s.videoId !== song.videoId)
    } else {
      next.add(song.videoId)
      nextSaved = [song, ...nextSaved]
    }
    setLikedSongs(next)
    setSavedSongs(nextSaved)
    syncToCloud(nextSaved, Array.from(next))
  }

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "0:00"
    const m = Math.floor(s / 60), sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play().catch(() => handleLoadStream())
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background transition-all duration-700 ease-[cubic-bezier(0.2,0,0,1)]">
      <header className="z-50 flex h-16 items-center justify-between px-4 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground shadow-lg transition-transform hover:scale-110 active:scale-95">
            <Music2 className="h-5 w-5 text-background" />
          </div>
          <span className="hidden sm:block text-xl font-black tracking-tighter">GANVO</span>
        </div>

        <div ref={searchContainerRef} className="relative flex-1 max-w-xl mx-4">
          <div className="relative group">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search music..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              className="h-12 w-full rounded-full border-0 bg-muted/50 pl-12 pr-12 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-card transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
            />
          </div>

          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 flex flex-col rounded-[2rem] border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500 ease-[cubic-bezier(0.2,0,0,1)]">
              <div className={cn("overflow-y-auto overscroll-contain transition-all", isSearchExpanded ? "max-h-[60vh]" : "max-h-[350px]")}>
                {searchQuery.trim() === "" ? (
                   <div className="p-4">
                     <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">History</span>
                     {searchHistory.map(h => (
                       <button key={h} onClick={() => setSearchQuery(h)} className="flex w-full items-center gap-3 p-3 rounded-2xl hover:bg-muted transition-all active:scale-95">
                         <History className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{h}</span>
                       </button>
                     ))}
                   </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {searchResults.map(s => (
                      <button key={s.videoId} onClick={() => addToQueueAndPlay(s)} className="flex w-full items-center gap-4 p-3 rounded-2xl hover:bg-primary/5 active:scale-95 transition-all">
                        <img src={s.thumbnail} className="h-12 w-12 rounded-lg object-cover shadow-md" />
                        <div className="flex-1 text-left overflow-hidden"><p className="truncate font-bold text-sm">{s.title}</p><p className="truncate text-xs text-muted-foreground">{s.artist}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {searchResults.length > 5 && (
                <button 
                  onMouseDown={e => e.preventDefault()} 
                  onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                  className="w-full p-4 border-t bg-muted/20 text-xs font-bold text-primary hover:bg-muted transition-all"
                >
                  {isSearchExpanded ? "Show Less" : `View All ${searchResults.length} Results`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" onClick={() => setIsDark(!isDark)} className="rounded-full h-11 w-11 transition-transform active:scale-75">
             {isDark ? <Sun /> : <Moon />}
           </Button>
           <Button onClick={() => user ? handleLogout() : setShowAuthDialog(true)} variant="ghost" size="icon" className="rounded-full h-11 w-11 transition-transform active:scale-75 overflow-hidden">
             {user ? <img src={user.photoURL || ""} className="rounded-full" /> : <UserCircle2 />}
           </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-y-auto pb-44 lg:pb-0 scroll-smooth overscroll-none">
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
            {currentSong ? (
              <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-700 ease-[cubic-bezier(0.2,0,0,1)]">
                <div className="relative group mb-10">
                  <div className={cn("relative mx-auto h-72 w-72 md:h-96 md:w-96 overflow-hidden rounded-[3rem] shadow-2xl transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]", isPlaying && "scale-105 shadow-primary/20")}>
                    <img src={currentSong.thumbnail} className="h-full w-full object-cover" />
                    {isLoading && <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-white" /></div>}
                    {loadError && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center text-white">
                        <p className="font-bold mb-4">{loadError}</p>
                        <Button onClick={handleLoadStream} variant="secondary" className="rounded-2xl font-bold px-8">Retry Stream</Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-8 px-2">
                  <div className="flex-1 overflow-hidden pr-4">
                    <h2 className="text-3xl font-black truncate tracking-tight">{currentSong.title}</h2>
                    <p className="text-lg font-semibold text-muted-foreground truncate">{currentSong.artist}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => toggleLike(currentSong)} className="h-14 w-14 rounded-full transition-all active:scale-50">
                    <Heart className={cn("h-7 w-7 transition-all", likedSongs.has(currentSong.videoId) && "fill-destructive text-destructive scale-125")} />
                  </Button>
                </div>

                <div className="mb-10 px-2">
                  <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={v => { if (audioRef.current) audioRef.current.currentTime = v[0] }} className="mb-4 cursor-pointer" />
                  <div className="flex justify-between text-xs font-black tabular-nums opacity-50 uppercase tracking-widest">
                    <span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-6 md:gap-10">
                   <Button variant="ghost" size="icon" onClick={() => setShuffle(!shuffle)} className={cn("rounded-full", shuffle && "text-primary bg-primary/10")}><Shuffle size={20}/></Button>
                   <Button variant="ghost" size="icon" onClick={playPrevious} className="h-14 w-14 rounded-full active:scale-75"><SkipBack fill="currentColor" size={28}/></Button>
                   
                   <Button onClick={togglePlay} className="h-20 w-20 md:h-24 md:w-24 rounded-[2.5rem] bg-primary text-primary-foreground shadow-2xl transition-all duration-500 hover:scale-110 active:scale-90 flex items-center justify-center p-0">
                     {isPlaying ? <Pause fill="currentColor" size={40} className="m-0 p-0" /> : <Play fill="currentColor" size={40} className="ml-1.5" />}
                   </Button>

                   <Button variant="ghost" size="icon" onClick={playNext} className="h-14 w-14 rounded-full active:scale-75"><SkipForward fill="currentColor" size={28}/></Button>
                   <Button variant="ghost" size="icon" onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")} className={cn("rounded-full", repeatMode !== "off" && "text-primary bg-primary/10")}>{repeatMode === "one" ? <Repeat1 size={20}/> : <Repeat size={20}/>}</Button>
                </div>
              </div>
            ) : (
              <div className="text-center opacity-40"><div className="h-32 w-32 bg-muted rounded-[3rem] flex items-center justify-center mx-auto mb-6"><Music2 size={48}/></div><p className="font-bold text-xl uppercase tracking-tighter">Search to start Ganvo</p></div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:flex w-[400px] border-l border-border/40 bg-card/40 backdrop-blur-3xl flex-col">
          <div className="flex p-3 gap-2 bg-muted/20">
            {['queue', 'lyrics', 'library'].map((t: any) => (
              <button key={t} onClick={() => setActiveTab(t)} className={cn("flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all", activeTab === t ? "bg-background shadow-lg scale-105" : "opacity-50")}>{t}</button>
            ))}
          </div>
          <ScrollArea className="flex-1 p-4">
             {activeTab === 'queue' && (
               <div className="space-y-2">
                 {queue.map((s, i) => (
                   <button key={i} onClick={() => setCurrentIndex(i)} className={cn("flex w-full items-center gap-4 p-3 rounded-2xl transition-all", i === currentIndex ? "bg-primary/10 scale-105 shadow-md" : "hover:bg-muted")}>
                     <img src={s.thumbnail} className="h-12 w-12 rounded-xl object-cover" />
                     <div className="flex-1 text-left overflow-hidden"><p className="font-bold truncate text-sm">{s.title}</p><p className="text-xs opacity-60 truncate">{s.artist}</p></div>
                   </button>
                 ))}
               </div>
             )}
          </ScrollArea>
        </aside>
      </main>

      {/* Floating Bottom Bar Mobile (Padding Fix) */}
      {currentSong && (
        <div className="fixed bottom-6 left-4 right-4 z-[100] lg:hidden animate-in slide-in-from-bottom-10 duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
          <div className="flex items-center gap-4 p-2.5 rounded-[2rem] bg-card/95 backdrop-blur-2xl border border-border/40 shadow-2xl">
            <img src={currentSong.thumbnail} className="h-14 w-14 rounded-2xl object-cover shadow-lg" />
            <div className="flex-1 overflow-hidden">
              <p className="font-black text-sm truncate leading-tight">{currentSong.title}</p>
              <p className="text-xs font-bold opacity-60 truncate">{currentSong.artist}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => toggleLike(currentSong)} className="rounded-full h-12 w-12 active:scale-50">
              <Heart className={cn("h-6 w-6 transition-all", likedSongs.has(currentSong.videoId) && "fill-destructive text-destructive")} />
            </Button>
            <Button onClick={togglePlay} className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl active:scale-90 flex items-center justify-center p-0">
               {isPlaying ? <Pause fill="currentColor" size={24}/> : <Play fill="currentColor" size={24} className="ml-1"/>}
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="rounded-[3rem] p-8 sm:max-w-md border-0 shadow-2xl">
          <div className="text-center">
            <div className="h-20 w-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-primary"><UserCircle2 size={40}/></div>
            <DialogTitle className="text-3xl font-black tracking-tighter mb-4">GANVO PROFILE</DialogTitle>
            <p className="text-muted-foreground font-medium mb-8">Sign in with Google to sync your library across all your devices.</p>
            <Button onClick={handleGoogleSignIn} className="w-full h-16 rounded-[1.5rem] font-black text-lg transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/20">
              Continue with Google
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
