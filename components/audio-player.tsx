"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { initializeApp, getApps } from "firebase/app"
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth"
import { getFirestore, doc, setDoc, getDoc, collection } from "firebase/firestore"
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
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1, Search, Shuffle,
  Repeat, Repeat1, Sun, Moon, Loader2, Music2, X, ListMusic, Mic2, MoreVertical,
  Info, Heart, ChevronDown, ChevronUp, ExternalLink, History, Library, UserCircle2, LogOut
} from "lucide-react"
import { cn } from "@/lib/utils"

// Your exact Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBI-ABs1S7Ln2jJ7xYxgUZwU1nEXZmqI2c",
  authDomain: "ganvotesting.firebaseapp.com",
  projectId: "ganvotesting",
  storageBucket: "ganvotesting.firebasestorage.app",
  messagingSenderId: "1083596663051",
  appId: "1:1083596663051:web:52900f44e84034b7421a0e"
};

// Auto-initialize Firebase
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
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
  const [savedSongs, setSavedSongs] = useState<any[]>([])
  const [searchFocused, setSearchFocused] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const currentSong = queue[currentIndex]

  // DEFINITION: Fixed ReferenceError
  const showSearchDropdown = searchFocused && (searchResults.length > 0 || isSearching || (searchQuery.trim() === "" && searchHistory.length > 0));

  // Firebase Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
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

  // Sync with Firestore
  const syncToFirebase = async (songs: any[], ids: string[]) => {
    if (user) {
      await setDoc(doc(db, "users", user.uid), {
        savedSongs: songs,
        likedSongs: ids,
        lastUpdated: new Date()
      }, { merge: true });
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setShowAuthDialog(false);
    } catch (e) { console.error("Login failed", e); }
  };

  const handleLogout = () => signOut(auth);

  // App Logic
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  }, [isDark])

  useEffect(() => {
    const history = localStorage.getItem('ganvo_history')
    if (history) setSearchHistory(JSON.parse(history))
  }, [])

  const saveSearch = (q: string) => {
    if (!q.trim()) return
    const newHist = [q, ...searchHistory.filter(x => x !== q)].slice(0, 10)
    setSearchHistory(newHist); localStorage.setItem('ganvo_history', JSON.stringify(newHist))
  }

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setIsSearching(false); return; }
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

  const handleLoadStream = async () => {
    if (!currentSong) return
    setIsLoading(true); setLoadError(null); setAudioUrl(null)
    try {
      const res = await fetch(`/api/music/stream/${currentSong.videoId}`)
      const data = await res.json()
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl)
        if (audioRef.current) {
          audioRef.current.src = data.audioUrl; audioRef.current.load()
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
        }
      } else { setLoadError("Stream could not be found.") }
    } catch (e) { setLoadError("Connection error.") }
    finally { setIsLoading(false) }
  }

  useEffect(() => { handleLoadStream() }, [currentSong?.videoId])

  const toggleLike = (song: any) => {
    const next = new Set(likedSongs)
    let nextSaved = [...savedSongs]
    if (next.has(song.videoId)) {
      next.delete(song.videoId); nextSaved = nextSaved.filter(s => s.videoId !== song.videoId)
    } else {
      next.add(song.videoId); nextSaved = [song, ...nextSaved]
    }
    setLikedSongs(next); setSavedSongs(nextSaved)
    syncToFirebase(nextSaved, Array.from(next))
  }

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "0:00"
    const m = Math.floor(s / 60), sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background transition-all duration-700 ease-[cubic-bezier(0.2,0,0,1)]">
      <audio ref={audioRef} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} 
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} 
        onEnded={() => repeatMode === "one" ? (audioRef.current!.currentTime = 0, audioRef.current!.play()) : playNext()}
      />

      {/* Header */}
      <header className="z-50 flex h-16 shrink-0 items-center justify-between px-4 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground shadow-lg transition-transform hover:scale-110 active:scale-95 duration-500 ease-[cubic-bezier(0.2,0,0,1)]">
            <Music2 className="h-5 w-5 text-background" />
          </div>
          <span className="hidden sm:block text-xl font-black tracking-tighter">GANVO</span>
        </div>

        <div ref={searchContainerRef} className="relative flex-1 max-w-xl mx-4">
          <div className="relative group">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              placeholder="Search artists, songs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              className="h-12 w-full rounded-full border-0 bg-muted/50 pl-12 pr-12 focus-visible:ring-2 focus-visible:ring-primary focus-visible:bg-card transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]"
            />
          </div>

          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-3 flex flex-col rounded-[2rem] border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-500 ease-[cubic-bezier(0.2,0,0,1)]">
              <ScrollArea className={cn("transition-all duration-500", isSearchExpanded ? "h-[60vh]" : "h-[350px]")}>
                {searchQuery.trim() === "" ? (
                   <div className="p-4">
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-3 mb-2 block">History</span>
                     {searchHistory.map(h => (
                       <button key={h} onClick={() => setSearchQuery(h)} className="flex w-full items-center gap-4 p-4 rounded-2xl hover:bg-muted active:scale-95 transition-all duration-300">
                         <History className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-bold">{h}</span>
                       </button>
                     ))}
                   </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {searchResults.map((s, i) => (
                      <button key={i} onClick={() => { saveSearch(s.title); addToQueueAndPlay(s) }} className="flex w-full items-center gap-4 p-3 rounded-2xl hover:bg-primary/5 active:scale-95 transition-all duration-300">
                        <img src={s.thumbnail} className="h-12 w-12 rounded-xl object-cover shadow-sm" />
                        <div className="flex-1 text-left overflow-hidden"><p className="truncate font-bold text-sm">{s.title}</p><p className="truncate text-xs text-muted-foreground">{s.artist}</p></div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {searchResults.length > 5 && (
                <button onMouseDown={e => e.preventDefault()} onClick={() => setIsSearchExpanded(!isSearchExpanded)} className="w-full p-4 border-t bg-muted/20 text-xs font-black text-primary hover:bg-muted transition-all duration-300">
                  {isSearchExpanded ? "SHOW LESS" : `VIEW ALL ${searchResults.length} RESULTS`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" onClick={() => setIsDark(!isDark)} className="rounded-full h-11 w-11 transition-all duration-500 hover:bg-muted active:scale-75">
             {isDark ? <Sun size={22}/> : <Moon size={22}/>}
           </Button>
           <Button onClick={() => user ? handleLogout() : setShowAuthDialog(true)} variant="ghost" size="icon" className="rounded-full h-11 w-11 transition-all duration-500 hover:bg-muted active:scale-75 overflow-hidden">
             {user ? <img src={user.photoURL || ""} className="h-7 w-7 rounded-full shadow-sm" /> : <UserCircle2 size={22} />}
           </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Main Player Area */}
        <div className="flex-1 flex flex-col overflow-y-auto pb-44 lg:pb-0 scroll-smooth">
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 min-h-full">
            {currentSong ? (
              <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-700 ease-[cubic-bezier(0.2,0,0,1)]">
                <div className="relative mx-auto h-72 w-72 md:h-96 md:w-96 mb-10 overflow-hidden rounded-[3rem] shadow-2xl transition-all duration-1000 ease-[cubic-bezier(0.2,0,0,1)]">
                  <img src={currentSong.thumbnail} className={cn("h-full w-full object-cover transition-transform duration-[3s]", isPlaying ? "scale-110" : "scale-100")} />
                  {isLoading && <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300"><Loader2 className="h-10 w-10 animate-spin text-white" /></div>}
                  {loadError && <div className="absolute inset-0 bg-black/60 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-white text-center">
                    <p className="font-bold mb-4">{loadError}</p><Button onClick={handleLoadStream} variant="secondary" className="rounded-2xl font-bold px-8">Retry Stream</Button>
                  </div>}
                </div>

                <div className="flex items-center justify-between mb-8 px-2">
                  <div className="flex-1 overflow-hidden pr-4"><h2 className="text-3xl font-black truncate tracking-tighter">{currentSong.title}</h2><p className="text-lg font-bold text-muted-foreground truncate">{currentSong.artist}</p></div>
                  <Button variant="ghost" size="icon" onClick={() => toggleLike(currentSong)} className="h-14 w-14 rounded-full transition-all duration-500 active:scale-50">
                    <Heart className={cn("h-7 w-7 transition-all duration-500", likedSongs.has(currentSong.videoId) && "fill-destructive text-destructive scale-125")} />
                  </Button>
                </div>

                <div className="mb-10 px-2">
                  <Slider value={[currentTime]} max={duration || 100} step={0.1} onValueChange={v => { if (audioRef.current) audioRef.current.currentTime = v[0] }} className="mb-4 cursor-pointer" />
                  <div className="flex justify-between text-[10px] font-black tabular-nums opacity-50 uppercase tracking-widest"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
                </div>

                <div className="flex items-center justify-center gap-6 md:gap-10">
                   <Button variant="ghost" size="icon" onClick={() => setShuffle(!shuffle)} className={cn("rounded-full transition-all duration-500 active:scale-75", shuffle && "text-primary bg-primary/10")}><Shuffle size={20}/></Button>
                   <Button variant="ghost" size="icon" onClick={() => setCurrentIndex(p => (p - 1 + queue.length) % queue.length)} className="h-14 w-14 rounded-full active:scale-75 transition-all duration-500"><SkipBack fill="currentColor" size={28}/></Button>
                   
                   <Button onClick={togglePlay} className="h-20 w-20 md:h-24 md:w-24 rounded-[2.5rem] bg-primary text-primary-foreground shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.2,0,0,1)] hover:scale-110 active:scale-90 flex items-center justify-center p-0 overflow-hidden">
                     {isPlaying ? <Pause fill="currentColor" size={40} /> : <Play fill="currentColor" size={40} className="ml-1.5" />}
                   </Button>

                   <Button variant="ghost" size="icon" onClick={() => setCurrentIndex(p => (p + 1) % queue.length)} className="h-14 w-14 rounded-full active:scale-75 transition-all duration-500"><SkipForward fill="currentColor" size={28}/></Button>
                   <Button variant="ghost" size="icon" onClick={() => setRepeatMode(repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off")} className={cn("rounded-full transition-all duration-500 active:scale-75", repeatMode !== "off" && "text-primary bg-primary/10")}>
                     {repeatMode === "one" ? <Repeat1 size={20}/> : <Repeat size={20}/>}
                   </Button>
                </div>
              </div>
            ) : (
              <div className="text-center opacity-40 animate-in fade-in slide-in-from-bottom-8 duration-1000"><div className="h-40 w-40 bg-muted rounded-[3.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><Music2 size={64}/></div><p className="font-black text-2xl tracking-tighter uppercase">Search to Start Ganvo</p></div>
            )}
            {/* Massive mobile padding spacer */}
            <div className="h-40 shrink-0 lg:hidden" />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:flex w-[400px] border-l border-border/40 bg-card/40 backdrop-blur-3xl flex-col transition-all duration-500">
          <div className="flex p-3 gap-2 bg-muted/20 border-b border-border/40">
            {['queue', 'lyrics', 'library'].map((t: any) => (
              <button key={t} onClick={() => setActiveTab(t)} className={cn("flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]", activeTab === t ? "bg-background shadow-lg scale-105" : "opacity-40 hover:opacity-100")}>{t}</button>
            ))}
          </div>
          <ScrollArea className="flex-1 p-4">
             {activeTab === 'queue' && (
               <div className="space-y-2">
                 {queue.map((s, i) => (
                   <button key={i} onClick={() => setCurrentIndex(i)} className={cn("flex w-full items-center gap-4 p-3 rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.2,0,0,1)]", i === currentIndex ? "bg-primary/10 scale-[1.02] shadow-md" : "hover:bg-muted active:scale-95")}>
                     <img src={s.thumbnail} className="h-12 w-12 rounded-xl object-cover shadow-sm" />
                     <div className="flex-1 text-left overflow-hidden"><p className="font-bold truncate text-sm">{s.title}</p><p className="text-xs opacity-60 truncate">{s.artist}</p></div>
                   </button>
                 ))}
               </div>
             )}
          </ScrollArea>
        </aside>
      </main>

      {/* Floating Bottom Player (Padding/Mobile Fix) */}
      {currentSong && (
        <div className="fixed bottom-6 left-4 right-4 z-[100] lg:hidden animate-in slide-in-from-bottom-10 duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
          <div className="flex items-center gap-4 p-2.5 rounded-[2.5rem] bg-card/95 backdrop-blur-2xl border border-border/40 shadow-2xl ring-1 ring-white/10">
            <img src={currentSong.thumbnail} className="h-14 w-14 rounded-2xl object-cover shadow-lg" />
            <div className="flex-1 overflow-hidden"><p className="font-black text-sm truncate leading-tight tracking-tight">{currentSong.title}</p><p className="text-xs font-bold opacity-60 truncate tracking-tight">{currentSong.artist}</p></div>
            <Button variant="ghost" size="icon" onClick={() => toggleLike(currentSong)} className="rounded-full h-12 w-12 transition-all duration-500 active:scale-50">
              <Heart className={cn("h-6 w-6 transition-all duration-500", likedSongs.has(currentSong.videoId) && "fill-destructive text-destructive")} />
            </Button>
            <Button onClick={togglePlay} className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-xl transition-all duration-500 active:scale-75 flex items-center justify-center p-0">
               {isPlaying ? <Pause fill="currentColor" size={24}/> : <Play fill="currentColor" size={24} className="ml-1"/>}
            </Button>
          </div>
        </div>
      )}

      {/* FIREBASE AUTH DIALOG */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="rounded-[3rem] p-8 sm:max-w-md border-0 shadow-2xl animate-in zoom-in-95 duration-500 ease-[cubic-bezier(0.2,0,0,1)] outline-none">
          <div className="text-center">
            <div className="h-24 w-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-primary animate-bounce shadow-inner duration-[2s]"><UserCircle2 size={48}/></div>
            <DialogTitle className="text-4xl font-black tracking-tighter mb-4">GANVO ID</DialogTitle>
            <p className="text-muted-foreground font-bold text-lg mb-10 leading-tight px-4">Securely sync your favorite tracks and custom library with Google Cloud.</p>
            <Button onClick={handleLogin} className="w-full h-16 rounded-[1.5rem] font-black text-xl transition-all duration-500 hover:scale-[1.03] active:scale-95 shadow-2xl shadow-primary/30">
              SIGN IN WITH GOOGLE
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function playNext() { /* Helper required for index jump */ }
