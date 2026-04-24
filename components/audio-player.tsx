"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { initializeApp, getApps, getApp } from "firebase/app"
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, User as FirebaseUser 
} from "firebase/auth"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { 
  Play, Pause, Search, Home, Library, Settings, Info, ListPlus, X, ThumbsUp, 
  Share2, MoreHorizontal, Youtube, Loader2, ListMusic, UserCircle2, LogOut, Moon, Trash2, History, Speaker, ListFilter,
  ArrowLeft
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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = typeof window !== "undefined" ? getAuth(app) : null;
const db = typeof window !== "undefined" ? getFirestore(app) : null;
const googleProvider = typeof window !== "undefined" ? new GoogleAuthProvider() : null;

interface Song { videoId: string; title: string; artist: string; artistId?: string | null; album: string; duration: number; thumbnail: string; }
interface Playlist { id: string; name: string; songs: Song[]; }
interface LyricLine { time: number; text: string; }
interface LyricsData { syncedLyrics: LyricLine[] | null; plainLyrics: string | null; }

const formatTime = (seconds: number) => {
  if (!isFinite(seconds)) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const VideoCard = ({ song, onClick }: { song: Song, onClick: () => void }) => (
  <div className="cursor-pointer group flex flex-col gap-2" onClick={onClick}>
     <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-secondary border border-border/40">
        <img src={song.thumbnail || "/placeholder.svg"} alt={song.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        {song.duration > 0 && <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded shadow-sm">{formatTime(song.duration)}</span>}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Play className="h-10 w-10 md:h-12 md:w-12 text-white fill-white drop-shadow-md" />
        </div>
     </div>
     <div className="flex gap-3 mt-1">
        <img src={song.thumbnail || "/placeholder.svg"} className="h-9 w-9 rounded-full object-cover border border-border shrink-0" />
        <div className="flex-1 min-w-0">
           <h3 className="font-semibold text-sm line-clamp-2 leading-snug text-foreground">{song.title}</h3>
           <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{song.artist}</p>
           <p className="text-xs text-muted-foreground">{song.album ? `${song.album} • ` : ''}Recommended</p>
        </div>
     </div>
  </div>
)

export function AudioPlayer() {
  const[isDark, setIsDark] = useState(false)
  const[activeView, setActiveView] = useState<'home' | 'watch' | 'library'>('home')

  const[searchQuery, setSearchQuery] = useState("")
  const[searchResults, setSearchResults] = useState<Song[]>([])
  const[isSearching, setIsSearching] = useState(false)
  const[searchHistory, setSearchHistory] = useState<string[]>([])
  const[searchFocused, setSearchFocused] = useState(false)
  
  const[queue, setQueue] = useState<Song[]>([])
  const[currentIndex, setCurrentIndex] = useState(0)
  const[isPlaying, setIsPlaying] = useState(false)
  const[currentTime, setCurrentTime] = useState(0)
  const[isLoading, setIsLoading] = useState(false)
  const[loadError, setLoadError] = useState<string | null>(null)
  
  const[lyrics, setLyrics] = useState<LyricsData | null>(null)
  const[currentLyricIndex, setCurrentLyricIndex] = useState(-1)

  const[exploreData, setExploreData] = useState<{creatorsPicks: Song[], artists: any[], songs: Song[], albums: any[]}>({creatorsPicks:[], artists:[], songs: [], albums:[]})
  const[isExploreLoading, setIsExploreLoading] = useState(true)
  const[exploreError, setExploreError] = useState(false)

  const[showAboutDialog, setShowAboutDialog] = useState(false)
  const[showPlayerSettings, setShowPlayerSettings] = useState(false) 
  const[showPlaylistDialog, setShowPlaylistDialog] = useState(false)
  const[newPlaylistName, setNewPlaylistName] = useState("")
  
  const [lyricsProvider, setLyricsProvider] = useState<'lrclib' | 'kugou'>('lrclib')
  const[audioQuality, setAudioQuality] = useState<'High' | 'Standard' | 'Low'>('High')
  const[autoPlaySimilar, setAutoPlaySimilar] = useState(false)
  const[saveSearchHistory, setSaveSearchHistory] = useState(true)
  
  const[showAuthDialog, setShowAuthDialog] = useState(false)
  const[showAccountSettings, setShowAccountSettings] = useState(false)
  const[user, setUser] = useState<FirebaseUser | null>(null)
  const[email, setEmail] = useState("")
  const[password, setPassword] = useState("")
  const[isSignUp, setIsSignUp] = useState(false)
  const[authError, setAuthError] = useState("")
  const[displayNameInput, setDisplayNameInput] = useState("")
  
  const[likedSongs, setLikedSongs] = useState<Set<string>>(new Set())
  const[savedSongs, setSavedSongs] = useState<Song[]>([])
  const[playlists, setPlaylists] = useState<Playlist[]>([])

  // YT IFrame Engine Refs
  const ytParentRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<any>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const handleEndedRef = useRef<() => void>(() => {})

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const currentSong = queue[currentIndex]

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
  },[isDark])

  useEffect(() => {
    try {
      const history = localStorage.getItem('ganvo_search_history')
      if (history) setSearchHistory(JSON.parse(history))
      const savedProvider = localStorage.getItem('ganvo_lyrics_provider')
      if (savedProvider) setLyricsProvider(savedProvider as 'lrclib' | 'kugou')
      const savedQuality = localStorage.getItem('ganvo_audio_quality')
      if (savedQuality) setAudioQuality(savedQuality as 'High' | 'Standard' | 'Low')
      const savedAutoPlay = localStorage.getItem('ganvo_autoplay_similar')
      if (savedAutoPlay !== null) setAutoPlaySimilar(savedAutoPlay === 'true')
      const savedHistoryEnabled = localStorage.getItem('ganvo_save_history')
      if (savedHistoryEnabled !== null) setSaveSearchHistory(savedHistoryEnabled === 'true')
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
      .catch(() => setExploreError(true))
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
          const localSaved = JSON.parse(localStorage.getItem('ganvo_saved_songs') || '[]')
          const localPlaylists = JSON.parse(localStorage.getItem('ganvo_playlists') || '[]')
          
          const combinedSaved =[...(data.savedSongs || []), ...localSaved].filter((v,i,a) => a.findIndex(t => (t.videoId === v.videoId)) === i)
          const combinedPlaylists =[...(data.playlists || []), ...localPlaylists].filter((v,i,a) => a.findIndex(t => (t.id === v.id)) === i)
          
          setSavedSongs(combinedSaved)
          setLikedSongs(new Set(combinedSaved.map((s: Song) => s.videoId)))
          setPlaylists(combinedPlaylists)
          
          await setDoc(userRef, { savedSongs: combinedSaved, playlists: combinedPlaylists }, { merge: true })
        } else {
          await setDoc(userRef, { savedSongs:[], playlists:[] })
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
    localStorage.setItem('ganvo_saved_songs', JSON.stringify(newSaved))
    localStorage.setItem('ganvo_playlists', JSON.stringify(newPlaylists))
    if (user && db) {
      try {
        const userRef = doc(db, "users", user.uid)
        await setDoc(userRef, { savedSongs: newSaved, playlists: newPlaylists }, { merge: true })
      } catch (e) {}
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    if (!email.includes('@')) {
      setAuthError("Please include an '@' in the email address.")
      return
    }
    if (!auth) return
    try {
      if (isSignUp) await createUserWithEmailAndPassword(auth, email, password)
      else await signInWithEmailAndPassword(auth, email, password)
      setShowAuthDialog(false)
      setEmail("")
      setPassword("")
    } catch (error: any) { setAuthError(error.message.replace("Firebase: ", "")) }
  }

  const handleGoogleSignIn = async () => {
    if (!auth || !googleProvider) return
    setAuthError("")
    try {
      await signInWithPopup(auth, googleProvider)
      setShowAuthDialog(false)
    } catch (error: any) { setAuthError(error.message.replace("Firebase: ", "")) }
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
    const newPlaylist: Playlist = { id: Date.now().toString(), name: newPlaylistName.trim(), songs:[] }
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
          return { ...p, songs:[...p.songs, song] }
        }
      }
      return p
    })
    setPlaylists(updatedPlaylists)
    syncToCloud(savedSongs, updatedPlaylists)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-radix-popper-content-wrapper]')) return;
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false)
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
      } catch (error) {} finally { setIsSearching(false) }
    }, 300)

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  },[searchQuery])

  const addToQueueAndPlay = async (song: Song) => {
    const saveSearchStr = searchQuery || song.title
    if (saveSearchStr.trim() && saveSearchHistory) {
      const newHistory =[saveSearchStr, ...searchHistory.filter(q => q !== saveSearchStr)].slice(0, 15)
      setSearchHistory(newHistory)
      localStorage.setItem('ganvo_search_history', JSON.stringify(newHistory))
    }
    
    setActiveView('watch');
    
    const existingIndex = queue.findIndex((s) => s.videoId === song.videoId)
    
    if (existingIndex >= 0) {
      if (currentIndex === existingIndex && ytPlayerRef.current) {
        setIsLoading(true);
        setCurrentTime(0);
        ytPlayerRef.current.loadVideoById(song.videoId);
        ytPlayerRef.current.playVideo();
      } else {
        setCurrentIndex(existingIndex);
      }
    } else {
      setQueue((prev) =>[...prev, song])
      setCurrentIndex(queue.length)
    }
    setSearchResults([])
    setSearchQuery("")
    setSearchFocused(false)
  }

  // ======== NATIVE YT IFRAME MOUNTING ======== //
  useEffect(() => {
    handleEndedRef.current = async () => {
      if (currentIndex === queue.length - 1 && autoPlaySimilar && currentSong) {
        setIsLoading(true);
        try {
          const res = await fetch(`/api/music/search?q=${encodeURIComponent(currentSong.artist + ' ' + currentSong.title)}`);
          const data = await res.json();
          const similar = (data.results ||[]).filter((s: Song) => !queue.find(q => q.videoId === s.videoId));
          if (similar.length > 0) {
            setQueue(prev =>[...prev, similar[0]]);
            setCurrentIndex(queue.length);
          } else setIsPlaying(false);
        } catch {
          setIsPlaying(false);
        } finally {
          setIsLoading(false);
        }
      } else {
        if (queue.length > 0 && currentIndex < queue.length - 1) {
           setCurrentIndex(currentIndex + 1);
        }
      }
    };
  });

  useEffect(() => {
    let isMounted = true;

    const initPlayer = () => {
      if (!ytParentRef.current || !isMounted) return;
      
      const playerDiv = document.createElement('div');
      playerDiv.style.width = '100%';
      playerDiv.style.height = '100%';
      ytParentRef.current.innerHTML = '';
      ytParentRef.current.appendChild(playerDiv);

      ytPlayerRef.current = new (window as any).YT.Player(playerDiv, {
        height: '100%', width: '100%',
        videoId: currentSong?.videoId || '', // Explicit payload bypass origin
        playerVars: { playsinline: 1, controls: 1, disablekb: 0, autoplay: 1 },
        events: {
          onReady: (event: any) => {
            if (isMounted) {
                if (currentSong) {
                   setIsLoading(true);
                   event.target.loadVideoById(currentSong.videoId);
                   event.target.playVideo();
                }
            }
          },
          onStateChange: (e: any) => {
            if (!isMounted) return;
            if (e.data === 1) { 
              setIsPlaying(true); setIsLoading(false);
            } else if (e.data === 2 || e.data === 0) { 
              setIsPlaying(false); setIsLoading(false);
              if (e.data === 0 && handleEndedRef.current) handleEndedRef.current();
            } else if (e.data === 3) {
              setIsPlaying(true); setIsLoading(true);
            }
          },
          onError: () => {
            setIsLoading(false); setIsPlaying(false);
            setLoadError("Video track unavailable in your region. Trying next...");
            setTimeout(() => { if (currentIndex < queue.length - 1) setCurrentIndex(currentIndex + 1) }, 3000);
          }
        }
      });
    };

    if (typeof window !== "undefined") {
      if ((window as any).YT && (window as any).YT.Player) {
        initPlayer();
      } else {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScript = document.getElementsByTagName("script")[0];
        if (firstScript && firstScript.parentNode) firstScript.parentNode.insertBefore(tag, firstScript);
        else document.head.appendChild(tag);

        const existingCallback = (window as any).onYouTubeIframeAPIReady;
        (window as any).onYouTubeIframeAPIReady = () => {
          if (existingCallback) existingCallback();
          initPlayer();
        };
      }
    }

    return () => {
      isMounted = false;
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
         ytPlayerRef.current.destroy();
         ytPlayerRef.current = null;
      }
      if (ytParentRef.current) ytParentRef.current.innerHTML = '';
    };
  },[]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
          setCurrentTime(ytPlayerRef.current.getCurrentTime() || 0);
        }
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  },[isPlaying]);

  useEffect(() => {
    if (currentSong && ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
      setIsLoading(true);
      setCurrentTime(0);
      setLoadError(null);
      ytPlayerRef.current.loadVideoById(currentSong.videoId);
      ytPlayerRef.current.playVideo();
    }
  },[currentSong?.videoId]);
  
  useEffect(() => {
    if (!currentSong) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === 'function') {
         ytPlayerRef.current.stopVideo();
      }
      setIsPlaying(false);
      setCurrentTime(0);
    }
  },[currentSong]);

  // ============================================================== //

  useEffect(() => {
    if (!currentSong) return

    const loadLyrics = async () => {
      setLyrics(null)
      setCurrentLyricIndex(-1)

      try {
        const params = new URLSearchParams({
          track: currentSong.title, artist: currentSong.artist,
          ...(currentSong.album && { album: currentSong.album }),
          ...(currentSong.duration && { duration: String(currentSong.duration) }),
          provider: lyricsProvider
        })
        const response = await fetch(`/api/lyrics?${params}`)
        const data = await response.json()
        if (data.syncedLyrics || data.plainLyrics) setLyrics({ syncedLyrics: data.syncedLyrics, plainLyrics: data.plainLyrics })
        else setLyrics({ syncedLyrics: null, plainLyrics: null })
      } catch (error) { setLyrics({ syncedLyrics: null, plainLyrics: null }) }
    }
    loadLyrics()
  },[currentSong?.videoId, lyricsProvider])

  useEffect(() => {
    if (!lyrics?.syncedLyrics) return
    const lyric = lyrics.syncedLyrics.findLast((l) => l.time <= currentTime)
    const index = lyric ? lyrics.syncedLyrics.indexOf(lyric) : -1

    if (index !== currentLyricIndex) {
      setCurrentLyricIndex(index)
    }
  },[currentTime, lyrics, currentLyricIndex])

  const togglePlay = useCallback(() => {
    if (!ytPlayerRef.current) return
    if (isPlaying) ytPlayerRef.current.pauseVideo()
    else ytPlayerRef.current.playVideo()
    setIsPlaying(!isPlaying)
  },[isPlaying])

  const removeFromQueue = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index))
    if (index < currentIndex) setCurrentIndex((prev) => prev - 1)
    else if (index === currentIndex && queue.length > 1 && index === queue.length - 1) setCurrentIndex((prev) => prev - 1)
  }

  const toggleLike = async (song: Song) => {
    setLikedSongs((prev) => {
      const next = new Set(prev)
      let newSaved =[...savedSongs]
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

  const showSearchDropdown = searchFocused && (searchResults.length > 0 || isSearching || (searchQuery.trim() === "" && searchHistory.length > 0))

  return (
    <div className="flex h-screen flex-col overflow-hidden font-sans relative bg-background text-foreground transition-colors duration-300">
      
      {/* HEADER */}
      <header className="z-40 flex h-16 flex-shrink-0 items-center justify-between px-4 bg-background border-b border-border/40 gap-4">
        <div className="flex items-center gap-1 cursor-pointer shrink-0" onClick={() => setActiveView('home')}>
          <Youtube className="h-8 w-8 text-red-600 fill-current" />
          <span className="text-xl font-bold tracking-tighter hidden sm:block">GanvoTube</span>
        </div>

        {/* SEARCH BAR */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-2xl w-full mx-2 md:mx-4">
          <div className="flex items-center w-full">
             <div className="relative flex-1">
               <Input
                 type="text"
                 placeholder="Search"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 onFocus={() => setSearchFocused(true)}
                 className="h-10 w-full rounded-l-full border border-border bg-background pl-5 pr-10 focus-visible:ring-1 focus-visible:ring-blue-500 shadow-inner"
               />
               {searchQuery && (
                 <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); setSearchResults([]) }} className="absolute right-1 top-0 h-10 w-10 rounded-full hover:bg-transparent text-muted-foreground">
                   <X className="h-5 w-5" />
                 </Button>
               )}
             </div>
             <Button className="h-10 w-12 md:w-16 rounded-r-full border border-l-0 border-border bg-secondary hover:bg-secondary/80 text-foreground shrink-0" variant="secondary">
               <Search className="h-5 w-5" />
             </Button>
          </div>

          {/* Search Dropdown */}
          {showSearchDropdown && (
            <div className="absolute left-0 right-0 top-full z-[60] mt-1 flex flex-col overflow-hidden rounded-xl border bg-card shadow-lg">
              <div className="flex-1 overflow-y-auto max-h-[70vh] p-2">
                {searchQuery.trim() === "" ? (
                  <div>
                    {searchHistory.map((historyItem, idx) => (
                      <button key={`history-${idx}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setSearchQuery(historyItem)} className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all duration-200 hover:bg-muted text-foreground">
                        <History className="h-4 w-4 text-muted-foreground opacity-70" />
                        <span className="font-medium text-sm">{historyItem}</span>
                      </button>
                    ))}
                  </div>
                ) : isSearching && searchResults.length === 0 ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <div>
                    {searchResults.map((song, index) => (
                      <div key={song.videoId} onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToQueueAndPlay(song) }} className="flex w-full items-center gap-3 rounded-xl p-2 cursor-pointer hover:bg-secondary/60 text-foreground transition-all duration-300">
                        <img src={song.thumbnail} alt={song.title} className="aspect-video h-12 rounded-lg object-cover shadow-sm bg-secondary" />
                        <div className="flex-1 overflow-hidden">
                          <p className="truncate font-semibold text-sm leading-tight text-foreground">{song.title}</p>
                          <p className="truncate text-xs text-muted-foreground mt-0.5">{song.artist}</p>
                        </div>
                        <span className="flex-shrink-0 text-xs font-medium text-muted-foreground">{formatTime(song.duration)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* PROFILE */}
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full bg-secondary hover:bg-secondary/80">
                {user ? (
                  <div className="h-full w-full rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm uppercase">
                    {user.displayName ? user.displayName.charAt(0) : user.email?.charAt(0) || "U"}
                  </div>
                ) : (
                  <UserCircle2 className="h-6 w-6 text-current" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl border-border z-[250]">
              {user ? (
                <div className="px-3 py-2.5 mb-1 bg-muted/50 rounded-xl">
                  <p className="text-sm font-bold truncate text-foreground">{user.displayName || "Library Synced"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              ) : (
                <div className="px-2 py-2 mb-1">
                  <Button onClick={() => setShowAuthDialog(true)} className="w-full justify-start rounded-xl font-semibold transition-all active:scale-[0.98] bg-primary text-primary-foreground hover:bg-primary/90" size="sm">Sign In / Sign Up</Button>
                </div>
              )}
              <DropdownMenuSeparator />
              {user && (
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setShowAccountSettings(true), 100); }} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium transition-colors text-foreground">
                  <UserCircle2 className="h-4 w-4 text-muted-foreground" /> Account Details
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setShowPlayerSettings(true), 100); }} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium transition-colors text-foreground">
                <Settings className="h-4 w-4 text-muted-foreground" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setTimeout(() => setShowAboutDialog(true), 100); }} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium transition-colors text-foreground">
                <Info className="h-4 w-4 text-muted-foreground" /> About
              </DropdownMenuItem>
              {user && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-3 rounded-xl py-2.5 font-medium text-destructive transition-colors">
                    <LogOut className="h-4 w-4 text-current" /> Sign Out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* MAIN BODY */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* SIDEBAR */}
        <aside className="hidden md:flex w-60 flex-col border-r border-border/40 bg-card/40 p-3 gap-2 overflow-y-auto">
           <Button variant={activeView === 'home' ? 'secondary' : 'ghost'} className="justify-start font-semibold rounded-xl" onClick={() => setActiveView('home')}>
              <Home className="mr-3 h-5 w-5" /> Home
           </Button>
           <Button variant={activeView === 'library' ? 'secondary' : 'ghost'} className="justify-start font-semibold rounded-xl" onClick={() => setActiveView('library')}>
              <Library className="mr-3 h-5 w-5" /> Library
           </Button>
           <div className="my-2 border-t border-border/50"></div>
           <Button variant="ghost" className="justify-start font-semibold rounded-xl" onClick={() => setShowPlayerSettings(true)}>
              <Settings className="mr-3 h-5 w-5" /> Settings
           </Button>
           <Button variant="ghost" className="justify-start font-semibold rounded-xl" onClick={() => setShowAboutDialog(true)}>
              <Info className="mr-3 h-5 w-5" /> About
           </Button>
        </aside>

        {/* MAIN SCROLL AREA */}
        <main className="flex-1 overflow-y-auto bg-muted/10 relative">
            
           {/* WATCH VIEW Container */}
           <div className={cn(
                 "transition-all duration-300 z-[100] mx-auto",
                 !currentSong && "hidden",
                 activeView === 'watch' 
                   ? "w-full max-w-[1600px] p-0 md:p-4 lg:p-6 pb-24 md:pb-6 block bg-transparent" 
                   : "fixed bottom-16 right-2 md:bottom-6 md:right-6 w-72 md:w-96 rounded-xl overflow-hidden shadow-2xl border border-border cursor-pointer group bg-card flex flex-col"
               )}
               onClick={() => { if (activeView !== 'watch') setActiveView('watch') }}
           >
              <div className={cn(activeView === 'watch' && "flex flex-col lg:flex-row gap-6 w-full")}>
                 <div className={cn(activeView === 'watch' && "flex-1 min-w-0")}>
                     {/* Video Player */}
                     <div className={cn("w-full aspect-video bg-black relative", activeView === 'watch' ? "md:rounded-xl" : "rounded-t-xl min-h-[160px]")}>
                         <div ref={ytParentRef} className="w-full h-full pointer-events-auto" />
                         {/* Miniplayer Overlay */}
                         {activeView !== 'watch' && (
                           <div className="absolute inset-0 z-10 hover:bg-black/20 transition-all flex items-start justify-end p-1 opacity-0 group-hover:opacity-100 cursor-pointer" onClick={() => setActiveView('watch')}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white" onClick={(e) => { e.stopPropagation(); ytPlayerRef.current?.stopVideo(); setActiveView('home'); setQueue([]); setCurrentIndex(0); }}>
                                 <X className="h-4 w-4" />
                              </Button>
                           </div>
                         )}
                     </div>
                     
                     {/* Details */}
                     {activeView === 'watch' && currentSong && (
                        <div className="mt-4 px-4 md:px-0">
                           <h1 className="text-xl md:text-2xl font-bold line-clamp-2 leading-tight">{currentSong.title}</h1>
                           
                           <div className="flex flex-wrap items-center justify-between gap-4 mt-3">
                              <div className="flex items-center gap-3">
                                 <img src={currentSong.thumbnail || "/placeholder.svg"} className="h-10 w-10 md:h-12 md:w-12 rounded-full object-cover" />
                                 <div>
                                    <p className="font-bold text-sm md:text-base leading-none">{currentSong.artist}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{currentSong.album || 'Channel'}</p>
                                 </div>
                                 <Button variant="secondary" className="ml-2 rounded-full font-bold hidden sm:flex bg-foreground text-background hover:bg-foreground/90">Subscribe</Button>
                              </div>
                              <div className="flex items-center gap-2">
                                 <Button variant="secondary" className="rounded-full bg-secondary hover:bg-secondary/80 font-semibold" onClick={() => toggleLike(currentSong)}>
                                    <ThumbsUp className={cn("h-4 w-4 mr-2", likedSongs.has(currentSong.videoId) && "fill-current text-blue-600")} /> 
                                    {likedSongs.has(currentSong.videoId) ? 'Liked' : 'Like'}
                                 </Button>
                                 <Button variant="secondary" className="rounded-full bg-secondary hover:bg-secondary/80 font-semibold hidden sm:flex"><Share2 className="h-4 w-4 mr-2"/> Share</Button>
                                 {playlists.length > 0 && (
                                    <DropdownMenu>
                                       <DropdownMenuTrigger asChild>
                                          <Button variant="secondary" className="rounded-full bg-secondary hover:bg-secondary/80 font-semibold"><ListPlus className="h-4 w-4 mr-2"/> Save</Button>
                                       </DropdownMenuTrigger>
                                       <DropdownMenuContent align="end" className="rounded-xl">
                                          <DropdownMenuItem disabled className="font-bold text-xs uppercase text-muted-foreground">Save to Playlist</DropdownMenuItem>
                                          {playlists.map(pl => (
                                            <DropdownMenuItem key={pl.id} onClick={() => addSongToPlaylist(pl.id, currentSong)} className="cursor-pointer font-semibold">{pl.name}</DropdownMenuItem>
                                          ))}
                                       </DropdownMenuContent>
                                    </DropdownMenu>
                                 )}
                                 <Button variant="secondary" size="icon" className="rounded-full bg-secondary hover:bg-secondary/80"><MoreHorizontal className="h-4 w-4"/></Button>
                              </div>
                           </div>

                           {/* Lyrics Box / Description */}
                           <div className="mt-4 bg-secondary/50 rounded-xl p-4">
                              <h3 className="font-bold mb-2 text-sm">Lyrics / Description</h3>
                              {lyrics?.plainLyrics ? (
                                 <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{lyrics.plainLyrics}</p>
                              ) : lyrics?.syncedLyrics ? (
                                 <div className="max-h-60 overflow-y-auto pr-2 space-y-2">
                                   {lyrics.syncedLyrics.map((l, i) => (
                                     <p key={i} className={cn("text-sm", i === currentLyricIndex ? "font-bold text-primary" : "text-muted-foreground")}>{l.text}</p>
                                   ))}
                                 </div>
                              ) : (
                                 <p className="text-sm text-muted-foreground">No lyrics available.</p>
                              )}
                           </div>
                        </div>
                     )}
                 </div>
                 
                 {/* Up Next Sidebar */}
                 {activeView === 'watch' && (
                    <div className="w-full lg:w-[350px] xl:w-[400px] flex flex-col gap-3 shrink-0 mt-6 lg:mt-0 px-4 lg:px-0">
                        <h3 className="font-bold text-lg">Up Next</h3>
                        {queue.map((song, i) => (
                           <div key={i} onClick={() => setCurrentIndex(i)} className={cn("flex gap-2 cursor-pointer p-2 rounded-xl hover:bg-secondary/50 transition-colors", i === currentIndex && "bg-secondary")}>
                               <div className="relative w-36 md:w-40 aspect-video rounded-lg overflow-hidden shrink-0 bg-secondary">
                                  <img src={song.thumbnail} className="w-full h-full object-cover" />
                                  <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1 rounded">{formatTime(song.duration)}</span>
                                  {i === currentIndex && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                       <Play className="h-6 w-6 text-white fill-white" />
                                    </div>
                                  )}
                               </div>
                               <div className="flex-1 min-w-0 py-1">
                                  <p className="font-semibold text-sm line-clamp-2 leading-snug">{song.title}</p>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{song.artist}</p>
                               </div>
                               <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 self-center" onClick={(e) => { e.stopPropagation(); removeFromQueue(i); }}>
                                  <X className="h-4 w-4" />
                               </Button>
                           </div>
                        ))}
                    </div>
                 )}

                 {/* Miniplayer Details */}
                 {activeView !== 'watch' && (
                    <div className="p-2 flex items-center gap-3 bg-card border-t border-border/50">
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-bold truncate leading-tight">{currentSong?.title}</p>
                           <p className="text-xs text-muted-foreground truncate">{currentSong?.artist}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
                           {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                        </Button>
                    </div>
                 )}
              </div>
           </div>

           {/* HOME VIEW */}
           <div className={cn(activeView === 'home' ? "block p-4 md:p-8" : "hidden")}>
              {isExploreLoading ? (
                 <div className="flex flex-col items-center justify-center py-32">
                   <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                   <p className="font-bold text-lg text-muted-foreground">Loading Recommendations...</p>
                 </div>
              ) : exploreError ? (
                 <div className="flex flex-col items-center justify-center py-32 text-center">
                   <p className="font-bold text-2xl mb-2 text-foreground">Explore Unavailable</p>
                   <p className="text-sm text-muted-foreground">Servers are temporarily busy. Use the search bar to find videos.</p>
                 </div>
              ) : (
                 <div className="space-y-10 max-w-[1800px] mx-auto">
                   {exploreData?.creatorsPicks?.length > 0 && (
                      <div>
                         <h2 className="text-xl md:text-2xl font-bold mb-4">Trending Now</h2>
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                            {exploreData.creatorsPicks.map((song, idx) => (
                               <VideoCard key={idx} song={song} onClick={() => addToQueueAndPlay(song)} />
                            ))}
                         </div>
                      </div>
                   )}
                   {exploreData?.songs?.length > 0 && (
                      <div>
                         <h2 className="text-xl md:text-2xl font-bold mb-4">Gaming & Entertainment</h2>
                         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                            {exploreData.songs.slice(0, 10).map((song, idx) => (
                               <VideoCard key={idx} song={song} onClick={() => addToQueueAndPlay(song)} />
                            ))}
                         </div>
                      </div>
                   )}
                   {exploreData?.artists?.length > 0 && (
                      <div>
                         <div className="flex items-center gap-3 mb-4 mt-8">
                            <img src="https://www.youtube.com/s/desktop/189bbd8b/img/favicon_144x144.png" className="h-8 w-8 rounded-full" />
                            <h2 className="text-xl md:text-2xl font-bold">Popular Channels</h2>
                         </div>
                         <div className="flex overflow-x-auto gap-4 md:gap-8 pb-4 no-scrollbar">
                            {exploreData.artists.map((artist, idx) => (
                               <div key={idx} className="flex flex-col items-center gap-3 cursor-pointer min-w-[120px] md:min-w-[140px] group">
                                  <img src={artist.thumbnail || "/placeholder.svg"} className="h-28 w-28 md:h-32 md:w-32 rounded-full object-cover group-hover:scale-105 transition-transform duration-300 shadow-md" />
                                  <p className="font-semibold text-sm truncate w-full text-center group-hover:text-blue-500 transition-colors">{artist.name}</p>
                                  <p className="text-xs text-muted-foreground">{artist.subscribers}</p>
                               </div>
                            ))}
                         </div>
                      </div>
                   )}
                 </div>
              )}
           </div>

           {/* LIBRARY VIEW */}
           <div className={cn(activeView === 'library' ? "block p-4 md:p-8" : "hidden")}>
              <div className="max-w-[1800px] mx-auto">
                 <h2 className="text-2xl font-bold mb-6">Library</h2>
                 
                 <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2"><ThumbsUp className="h-5 w-5"/> Liked Videos</h3>
                    </div>
                    {savedSongs.length > 0 ? (
                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                          {savedSongs.map((song, idx) => (
                             <VideoCard key={idx} song={song} onClick={() => addToQueueAndPlay(song)} />
                          ))}
                       </div>
                    ) : (
                       <p className="text-muted-foreground">You haven't liked any videos yet.</p>
                    )}
                 </div>

                 <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2"><ListMusic className="h-5 w-5"/> Playlists</h3>
                      <Button onClick={() => setShowPlaylistDialog(true)} variant="secondary" size="sm" className="rounded-full font-bold">New Playlist</Button>
                    </div>
                    {playlists.length > 0 ? (
                       <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                          {playlists.map(pl => (
                             <div key={pl.id} className="cursor-pointer group">
                                <div className="w-full aspect-video bg-secondary rounded-xl flex items-center justify-center mb-2 group-hover:bg-secondary/80 transition-colors relative overflow-hidden">
                                   {pl.songs.length > 0 ? (
                                      <img src={pl.songs[0].thumbnail} className="w-full h-full object-cover blur-sm opacity-50" />
                                   ) : (
                                      <ListMusic className="h-8 w-8 text-muted-foreground" />
                                   )}
                                   <div className="absolute inset-0 flex items-center justify-center transition-opacity rounded-xl">
                                      <Play className="h-8 w-8 text-white fill-white drop-shadow-md" />
                                   </div>
                                </div>
                                <h4 className="font-bold text-sm line-clamp-1">{pl.name}</h4>
                                <p className="text-xs text-muted-foreground">{pl.songs.length} videos</p>
                             </div>
                          ))}
                       </div>
                    ) : (
                       <p className="text-muted-foreground">No playlists created.</p>
                    )}
                 </div>
              </div>
           </div>

        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden flex bg-background border-t border-border/40 shrink-0 pb-2 z-[200]">
         <button className={cn("flex-1 py-3 flex flex-col items-center gap-1", activeView === 'home' ? "text-foreground" : "text-muted-foreground")} onClick={() => setActiveView('home')}>
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-medium">Home</span>
         </button>
         <button className={cn("flex-1 py-3 flex flex-col items-center gap-1", activeView === 'library' ? "text-foreground" : "text-muted-foreground")} onClick={() => setActiveView('library')}>
            <Library className="h-5 w-5" />
            <span className="text-[10px] font-medium">Library</span>
         </button>
      </nav>

      {/* DIALOGS */}
      <Dialog open={showPlayerSettings} onOpenChange={setShowPlayerSettings}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-0 border-0 shadow-2xl outline-none bg-background !z-[400]">
          <div className="flex items-center gap-4 p-5 border-b bg-card/50">
            <Button variant="ghost" size="icon" onClick={() => setShowPlayerSettings(false)} className="rounded-full text-foreground"><ArrowLeft className="w-6 h-6"/></Button>
            <h2 className="text-xl font-bold text-foreground">Settings</h2>
          </div>
          <div className="p-2 overflow-y-auto max-h-[70vh] no-scrollbar pb-10">
             
             {/* Appearance Settings */}
             <div className="px-4 py-2 space-y-1">
               <h3 className="text-[13px] font-bold text-primary mb-4 ml-2">Appearance</h3>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsDark(!isDark)}>
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><Moon className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-foreground">Dark mode</span>
                     <span className="text-xs font-normal text-muted-foreground">Toggle application theme.</span>
                   </div>
                 </div>
                 <Switch checked={isDark} onCheckedChange={setIsDark} className="shrink-0 pointer-events-none" />
               </div>
             </div>
             
             {/* Audio Settings */}
             <div className="px-4 py-4 space-y-1">
               <h3 className="text-[13px] font-bold text-primary mb-4 ml-2">Audio & Playback</h3>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><Speaker className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-foreground">Audio quality</span>
                     <span className="text-xs font-normal text-muted-foreground">Streaming quality preset.</span>
                   </div>
                 </div>
                 <Select value={audioQuality} onValueChange={(v: any) => { setAudioQuality(v); localStorage.setItem('ganvo_audio_quality', v)}}>
                    <SelectTrigger className="w-[110px] rounded-xl font-bold bg-muted border-none text-foreground text-xs h-9 shrink-0 outline-none focus:ring-0">
                      <SelectValue placeholder="Quality" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl z-[500]">
                      <SelectItem value="High" className="font-bold py-2 text-xs">High</SelectItem>
                      <SelectItem value="Standard" className="font-bold py-2 text-xs">Standard</SelectItem>
                      <SelectItem value="Low" className="font-bold py-2 text-xs">Low</SelectItem>
                    </SelectContent>
                  </Select>
               </div>

               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><ListFilter className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-semibold text-base text-foreground">Auto-play similar</span>
                     <span className="text-xs font-normal text-muted-foreground">Keep playing videos when queue ends.</span>
                   </div>
                 </div>
                 <Switch checked={autoPlaySimilar} onCheckedChange={(val) => { setAutoPlaySimilar(val); localStorage.setItem('ganvo_autoplay_similar', val.toString()) }} className="shrink-0" />
               </div>
             </div>
             
             {/* Data Settings */}
             <div className="px-4 py-4 space-y-1">
               <h3 className="text-[13px] font-bold text-primary mb-4 ml-2">Data & Privacy</h3>
               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-muted/50 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-muted/80 rounded-full text-foreground"><History className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-semibold text-base text-foreground">Save search history</span>
                     <span className="text-xs font-normal text-muted-foreground">Remember your previous searches.</span>
                   </div>
                 </div>
                 <Switch checked={saveSearchHistory} onCheckedChange={(val) => { setSaveSearchHistory(val); localStorage.setItem('ganvo_save_history', val.toString()) }} className="shrink-0" />
               </div>

               <div className="flex items-center justify-between p-3 bg-transparent rounded-2xl cursor-pointer hover:bg-destructive/10 transition-colors text-destructive" onClick={() => { if(window.confirm("Clear all app preferences and search history? Your cloud playlists will not be deleted.")) { localStorage.clear(); window.location.reload(); } }}>
                 <div className="flex items-center gap-4">
                   <div className="p-2 bg-destructive/10 rounded-full text-current"><Trash2 className="w-5 h-5 text-current"/></div>
                   <div className="flex flex-col">
                     <span className="font-bold text-base text-current">Clear all local data</span>
                     <span className="text-xs font-normal opacity-80">Resets settings and search history.</span>
                   </div>
                 </div>
               </div>
             </div>

          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-0 shadow-2xl outline-none bg-background !z-[400]">
          <DialogHeader>
            <div className="mb-6 flex justify-center"><div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary/10 text-primary"><UserCircle2 className="h-10 w-10 text-current" /></div></div>
            <DialogTitle className="text-2xl font-extrabold text-center text-foreground">Account Sync</DialogTitle>
            <DialogDescription className="font-medium text-center mt-2">Sign in to save your playlists and liked videos to the cloud.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEmailAuth} className="space-y-4 mt-2">
            <div className="space-y-3">
              <Input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="h-14 rounded-2xl bg-muted/50 border-transparent focus-visible:ring-primary font-medium px-4 text-foreground outline-none" />
              <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="h-14 rounded-2xl bg-muted/50 border-transparent focus-visible:ring-primary font-medium px-4 text-foreground outline-none" />
            </div>
            {authError && <p className="text-xs font-bold text-destructive text-center p-3 bg-destructive/10 rounded-xl">{authError}</p>}
            <Button type="submit" className="w-full h-14 rounded-2xl font-bold text-base shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] text-primary-foreground">{isSignUp ? "Create Account" : "Sign In"}</Button>
            <div className="flex items-center gap-2 my-4"><div className="flex-1 h-px bg-border"></div><span className="text-xs font-bold text-muted-foreground uppercase">OR</span><div className="flex-1 h-px bg-border"></div></div>
            <Button type="button" variant="outline" onClick={handleGoogleSignIn} className="w-full h-14 rounded-2xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-foreground">Continue with Google</Button>
            <p className="text-sm text-center font-bold text-primary mt-4 cursor-pointer hover:underline" onClick={() => {setIsSignUp(!isSignUp); setAuthError("")}}>{isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}</p>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAccountSettings} onOpenChange={setShowAccountSettings}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-0 shadow-2xl outline-none bg-background !z-[400]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold flex items-center gap-3 text-foreground"><UserCircle2 className="h-6 w-6 text-primary"/> Account Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProfile} className="space-y-6 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-bold ml-1 text-muted-foreground">Display Name</label>
              <Input value={displayNameInput} onChange={e => setDisplayNameInput(e.target.value)} placeholder="Your Name" className="h-14 rounded-2xl bg-muted/50 border-transparent font-bold px-4 text-lg text-foreground outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold ml-1 text-muted-foreground">Email Address</label>
              <Input value={user?.email || ""} disabled className="h-14 rounded-2xl bg-muted/30 border-transparent font-medium px-4 text-muted-foreground opacity-70 outline-none" />
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl font-bold text-base shadow-lg transition-transform active:scale-[0.98] text-primary-foreground">Save Changes</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlaylistDialog} onOpenChange={setShowPlaylistDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-8 border-0 shadow-2xl outline-none bg-background !z-[400]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold flex items-center gap-3 text-foreground"><ListPlus className="h-6 w-6 text-primary"/> New Playlist</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePlaylist} className="space-y-6 mt-4">
            <div className="space-y-2">
              <Input value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="Playlist Name" autoFocus required className="h-14 rounded-2xl bg-muted/50 border-transparent font-bold px-4 text-lg text-foreground outline-none" />
            </div>
            <Button type="submit" className="w-full h-14 rounded-2xl font-bold text-base shadow-lg transition-transform active:scale-[0.98] text-primary-foreground">Create Playlist</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-6 sm:p-8 border-0 shadow-2xl outline-none bg-background !z-[400]">
          <DialogHeader>
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-red-600 shadow-lg"><Youtube className="h-8 w-8 text-white fill-white" /></div>
              <div>
                <DialogTitle className="text-2xl font-extrabold tracking-tight text-foreground">GanvoTube</DialogTitle>
                <DialogDescription className="font-semibold mt-1">Version 1.1.0</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 text-sm font-medium text-muted-foreground leading-relaxed mt-2">
            <p>A modern video player inspired by YouTube, featuring a complete SPA architecture with floating miniplayer capabilities.</p>
            <p>Built with Next.js App Router, Tailwind CSS, Firebase Auth, and shadcn/ui.</p>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
