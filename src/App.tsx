/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TikTokHeartIcon,
  TikTokCommentIcon,
  TikTokBookmarkIcon,
  TikTokShareArrowIcon,
  TikTokCreatePlusButton,
  SpinningVinylDisc,
  VerifiedBadgeIcon,
} from './components/TikTokIcons';
import {
  VideoFeedItem,
  CommentItem,
  UploadModal,
  ShareDrawer,
} from './components/ActionDrawers';

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
}

interface UserProfile {
  name: string;
  handle: string;
  phone?: string;
  bio: string;
  avatar: string;
  followingCount: number;
  followersCount: number;
  likesCount?: number;
}

interface CreatorSummary {
  name: string;
  handle: string;
  avatar: string;
  verified: boolean;
  followers: number;
  followingCount?: number;
  totalLikes?: number;
  bio?: string;
}

type ScreenMode =
  | 'feed'
  | 'search-input'
  | 'search-results'
  | 'my-profile'
  | 'creator-profile';

const TOP_TABS = [
  { id: 'comedy', label: 'Following' },
  { id: 'cricket', label: 'Friends' },
  { id: 'for-you', label: 'For You' },
];

function formatCompactCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenMode>('feed');
  const [isAppInForeground, setIsAppInForeground] = useState(true);

  // Main Feed State
  const [videos, setVideos] = useState<VideoFeedItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState('for-you');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Playback State
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>({});
  const [followedHandles, setFollowedHandles] = useState<Record<string, boolean>>({});
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeart[]>([]);

  // Search State
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [suggestKeywords, setSuggestKeywords] = useState<string[]>([]);
  const [searchResultVideos, setSearchResultVideos] = useState<VideoFeedItem[]>([]);
  const [searchResultUsers, setSearchResultUsers] = useState<CreatorSummary[]>([]);
  const [searchTab, setSearchTab] = useState<'top' | 'users' | 'videos' | 'sounds' | 'hashtags'>('top');
  const [isSearchingResults, setIsSearchingResults] = useState(false);

  // Other Creator Profile State
  const [viewedCreator, setViewedCreator] = useState<CreatorSummary | null>(null);
  const [creatorVideos, setCreatorVideos] = useState<VideoFeedItem[]>([]);
  const [isLoadingCreator, setIsLoadingCreator] = useState(false);

  // Real TikTok Account State (Phone Number + @Username + Cloud Persistence)
  const [authToken, setAuthToken] = useState<string>(() => {
    try {
      return localStorage.getItem('turbotok_auth_token') || 'cloud-session';
    } catch {
      return 'cloud-session';
    }
  });
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myAccountVideos, setMyAccountVideos] = useState<VideoFeedItem[]>([]);
  const [profileTab, setProfileTab] = useState<'uploaded' | 'saved' | 'liked' | 'private'>('uploaded');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editHandle, setEditHandle] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBio, setEditBio] = useState('');

  // Comments & Drawers
  const [commentsByVideo, setCommentsByVideo] = useState<Record<string, CommentItem[]>>({});
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [shareVideo, setShareVideo] = useState<VideoFeedItem | null>(null);
  const [isMobileCommentsOpen, setIsMobileCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const lastTapRef = useRef<number>(0);

  // Web Audio API Booster Ref (Boosts quiet video sound by 2x on mobile speakers!)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const boostedNodesRef = useRef<WeakSet<HTMLMediaElement>>(new WeakSet());

  const showToast = useCallback((msg: string) => {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((prev) => (prev === msg ? null : prev));
    }, 2200);
  }, []);

  const boostVideoAudio = useCallback((videoEl: HTMLVideoElement | null) => {
    if (!videoEl) return;
    videoEl.volume = 1.0;
    try {
      // Only attach Web Audio GainNode for same-origin streams (/api/uploads/...) to avoid CORS tainting
      if (videoEl.src && videoEl.src.includes('/api/uploads/')) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioCtx();
        }
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        if (!boostedNodesRef.current.has(videoEl)) {
          const source = audioCtxRef.current.createMediaElementSource(videoEl);
          const gainNode = audioCtxRef.current.createGain();
          gainNode.gain.value = 2.2; // 220% Volume Boost for loud, clear mobile speaker sound!
          source.connect(gainNode);
          gainNode.connect(audioCtxRef.current.destination);
          boostedNodesRef.current.add(videoEl);
        }
      }
    } catch {}
  }, []);

  // Stop all audio & clear Android notification bar immediately when app goes to background or user leaves feed
  const stopAllMediaImmediately = useCallback(() => {
    if (activeVideoRef.current) {
      activeVideoRef.current.pause();
      activeVideoRef.current.muted = true;
    }
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
      } catch {}
    }
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      const visible = !document.hidden;
      setIsAppInForeground(visible);
      if (!visible) {
        stopAllMediaImmediately();
      }
    };
    const handleBlurOrHide = () => {
      if (document.hidden) {
        setIsAppInForeground(false);
        stopAllMediaImmediately();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleBlurOrHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleBlurOrHide);
    };
  }, [stopAllMediaImmediately]);

  useEffect(() => {
    if (activeScreen !== 'feed') {
      stopAllMediaImmediately();
    }
  }, [activeScreen, stopAllMediaImmediately]);

  // Restore Logged-In TikTok Account Session on mount (Automatically restores @barkatalu23 from Cloud Server even after phone reset!)
  useEffect(() => {
    fetch('/api/profile', {
      headers: { 'x-auth-token': authToken },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile) {
          setProfile(data.profile);
          setEditName(data.profile.name);
          setEditHandle(data.profile.handle);
          setEditPhone(data.profile.phone || '');
          setEditBio(data.profile.bio || '');
          if (!authToken || authToken === 'logged-out') {
            setAuthToken('cloud-session');
          }
          if (Array.isArray(data.uploadedVideos)) {
            setMyAccountVideos(data.uploadedVideos);
          }
          if (Array.isArray(data.likedVideoIds)) {
            const map: Record<string, boolean> = {};
            data.likedVideoIds.forEach((id: string) => {
              map[id] = true;
            });
            setLikedIds((prev) => ({ ...prev, ...map }));
          }
          if (Array.isArray(data.bookmarkedVideoIds)) {
            const map: Record<string, boolean> = {};
            data.bookmarkedVideoIds.forEach((id: string) => {
              map[id] = true;
            });
            setBookmarkedIds((prev) => ({ ...prev, ...map }));
          }
          if (Array.isArray(data.followingHandles)) {
            const map: Record<string, boolean> = {};
            data.followingHandles.forEach((h: string) => {
              map[h] = true;
              map[h.replace(/^@/, '')] = true;
            });
            setFollowedHandles((prev) => ({ ...prev, ...map }));
          }
        } else {
          setProfile(null);
        }
      })
      .catch(() => {});
  }, [authToken]);

  // Real-Time TikTok Algorithm Watch-Time & Seen-Video Tracking Refs
  const slideStartTimeRef = useRef<number>(Date.now());
  const prevActiveIndexRef = useRef<number>(0);
  const seenIdsRef = useRef<string[]>([]);

  useEffect(() => {
    try {
      const savedSeen = JSON.parse(localStorage.getItem('turbotok_seen_ids') || '[]');
      if (Array.isArray(savedSeen)) {
        seenIdsRef.current = savedSeen.slice(-60);
      }
    } catch {}
  }, []);

  const markVideoSeenLocally = useCallback((rawId: string) => {
    const baseId = String(rawId || '').replace(/-p\d+$/, '');
    if (!baseId) return;
    const next = seenIdsRef.current.filter((id) => id !== baseId);
    next.push(baseId);
    if (next.length > 60) next.shift();
    seenIdsRef.current = next;
    try {
      localStorage.setItem('turbotok_seen_ids', JSON.stringify(next));
    } catch {}
  }, []);

  // Fetch Main Feed (Passes seen video history so watched videos don't repeat!)
  const fetchFeedPage = useCallback(
    async (category: string, pageNum: number, append: boolean) => {
      if (pageNum === 1) {
        setIsLoading(true);
        setLoadError('');
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          category,
          page: String(pageNum),
          seen: seenIdsRef.current.slice(-35).join(','),
          t: String(Date.now()),
        });
        const res = await fetch(`/api/feed?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const incoming: VideoFeedItem[] = Array.isArray(data.videos) ? data.videos : [];

        if (incoming[0]) {
          markVideoSeenLocally(incoming[0].id);
        }

        if (append) {
          setVideos((prev) => [...prev, ...incoming]);
        } else {
          if (incoming.length > 0) {
            setVideos(incoming);
            setActiveIndex(0);
            prevActiveIndexRef.current = 0;
            slideStartTimeRef.current = Date.now();
            if (feedScrollRef.current) {
              feedScrollRef.current.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
            }
          } else {
            setVideos([]);
            setLoadError('No videos found.');
          }
        }
      } catch {
        if (!append) {
          setLoadError('Connection slow. Tap Retry to load videos.');
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [markVideoSeenLocally]
  );

  // Send Watch-Time & Skip Signal to TikTok Recommendation Algorithm whenever user swipes to next slide!
  useEffect(() => {
    if (activeScreen !== 'feed' || videos.length === 0) return;

    const prevIdx = prevActiveIndexRef.current;
    if (prevIdx !== activeIndex && videos[prevIdx]) {
      const prevVideo = videos[prevIdx];
      const watchSeconds = Number(((Date.now() - slideStartTimeRef.current) / 1000).toFixed(1));
      markVideoSeenLocally(prevVideo.id);

      fetch('/api/algorithm/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: prevVideo.id,
          authorName: prevVideo.author.name,
          authorHandle: prevVideo.author.handle,
          watchSeconds,
          completed: watchSeconds >= 9,
          liked: Boolean(likedIds[prevVideo.id]),
        }),
      }).catch(() => {});
    }

    if (videos[activeIndex]) {
      markVideoSeenLocally(videos[activeIndex].id);
    }
    prevActiveIndexRef.current = activeIndex;
    slideStartTimeRef.current = Date.now();
  }, [activeIndex, activeScreen, videos, likedIds, markVideoSeenLocally]);

  useEffect(() => {
    setPage(1);
    fetchFeedPage(activeCategory, 1, false);
  }, [activeCategory, fetchFeedPage]);

  // Infinite Scroll
  useEffect(() => {
    if (
      activeScreen === 'feed' &&
      !isLoading &&
      !isLoadingMore &&
      videos.length > 0 &&
      activeIndex >= videos.length - 4
    ) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFeedPage(activeCategory, nextPage, true);
    }
  }, [activeScreen, activeIndex, videos.length, isLoading, isLoadingMore, page, activeCategory, fetchFeedPage]);

  // Native GPU Scroll Snap Detection via IntersectionObserver
  useEffect(() => {
    if (activeScreen !== 'feed') return;
    const container = feedScrollRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idxAttr = entry.target.getAttribute('data-index');
            if (idxAttr !== null) {
              const idx = Number(idxAttr);
              if (!Number.isNaN(idx)) {
                setActiveIndex(idx);
                setIsPlaying(true);
              }
            }
          }
        }
      },
      {
        root: container,
        threshold: 0.6,
      }
    );

    const slides = container.querySelectorAll('[data-slide="true"]');
    slides.forEach((s) => observer.observe(s));

    return () => observer.disconnect();
  }, [videos.length, activeScreen]);

  // Play active <video> only when on feed AND in foreground, with 2x Volume Boost!
  useEffect(() => {
    const vid = activeVideoRef.current;
    if (!vid) return;

    if (activeScreen !== 'feed' || !isAppInForeground) {
      vid.pause();
      return;
    }

    vid.volume = 1.0;
    vid.muted = isMuted;
    boostVideoAudio(vid);

    const p = vid.play();
    if (p !== undefined) {
      p.catch(() => {
        vid.muted = true;
        vid.play().catch(() => {});
      });
    }
  }, [activeIndex, isMuted, activeScreen, isAppInForeground, boostVideoAudio]);

  // Clean Live Search Autocomplete
  useEffect(() => {
    if (activeScreen !== 'search-input') return;
    const q = searchInput.trim();
    if (!q) {
      setSuggestKeywords([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestKeywords(Array.isArray(data.keywords) ? data.keywords : []);
        }
      } catch {}
    }, 120);

    return () => clearTimeout(timer);
  }, [searchInput, activeScreen]);

  // Execute Search -> Opens 2-Column TikTok Search Results Page
  const executeSearchToGrid = async (q: string) => {
    const cleaned = q.trim();
    if (!cleaned) return;
    stopAllMediaImmediately();
    setSearchInput(cleaned);
    setActiveSearchQuery(cleaned);
    setSearchTab('top');
    setActiveScreen('search-results');
    setIsSearchingResults(true);

    try {
      const res = await fetch(`/api/search/results?q=${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      setSearchResultVideos(Array.isArray(data.videos) ? data.videos : []);
      setSearchResultUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setSearchResultVideos([]);
      setSearchResultUsers([]);
    } finally {
      setIsSearchingResults(false);
    }
  };

  // Open Any Creator's Profile (In exact White TikTok Profile style!)
  const openCreatorProfile = async (name: string, handle: string, avatar = '') => {
    stopAllMediaImmediately();
    const cleanH = handle.replace(/^@/, '').toLowerCase();
    if (profile && cleanH === profile.handle.replace(/^@/, '').toLowerCase()) {
      setActiveScreen('my-profile');
      return;
    }

    setViewedCreator({
      name,
      handle: handle.replace(/^@/, ''),
      avatar,
      verified: false,
      followers: 0,
      followingCount: 0,
      totalLikes: 0,
    });
    setCreatorVideos([]);
    setActiveScreen('creator-profile');
    setIsLoadingCreator(true);

    try {
      const res = await fetch(
        `/api/creator?name=${encodeURIComponent(name)}&handle=${encodeURIComponent(handle)}`
      );
      const data = await res.json();
      if (data?.creator) {
        setViewedCreator({
          ...data.creator,
          verified: false,
          followers: data.creator.followersCount ?? data.creator.followers ?? 0,
        });
      }
      if (Array.isArray(data?.videos)) {
        setCreatorVideos(data.videos);
      }
    } catch {
    } finally {
      setIsLoadingCreator(false);
    }
  };

  // Play a video clicked from Search Results Grid or Profile Grid
  const playVideosListAt = (list: VideoFeedItem[], startIdx: number) => {
    if (list.length === 0) return;
    setVideos(list);
    setActiveIndex(startIdx);
    setIsPlaying(true);
    setActiveScreen('feed');
    setTimeout(() => {
      if (feedScrollRef.current) {
        const h = feedScrollRef.current.clientHeight;
        feedScrollRef.current.scrollTo({ top: startIdx * h, behavior: 'instant' as ScrollBehavior });
      }
    }, 20);
  };

  const activeVideo = videos[activeIndex] || null;

  useEffect(() => {
    if (!activeVideo) return;
    if (commentsByVideo[activeVideo.id]) return;

    fetch(`/api/videos/${encodeURIComponent(activeVideo.id)}/comments`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.comments)) {
          setCommentsByVideo((prev) => ({
            ...prev,
            [activeVideo.id]: data.comments,
          }));
        }
      })
      .catch(() => {});
  }, [activeVideo?.id]);

  const handleLikeToggle = (video: VideoFeedItem, forceLike = false) => {
    const alreadyLiked = Boolean(likedIds[video.id]);
    if (forceLike && alreadyLiked) return;

    const nextLiked = forceLike ? true : !alreadyLiked;
    setLikedIds((prev) => ({ ...prev, [video.id]: nextLiked }));

    setVideos((prev) =>
      prev.map((item) =>
        item.id === video.id
          ? {
              ...item,
              stats: {
                ...item.stats,
                likes: item.stats.likes + (nextLiked ? 1 : -1),
              },
            }
          : item
      )
    );

    fetch(`/api/videos/${encodeURIComponent(video.id)}/interact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': authToken,
      },
      body: JSON.stringify({ type: nextLiked ? 'like' : 'unlike' }),
    }).catch(() => {});
  };

  const handleBookmarkToggle = (video: VideoFeedItem) => {
    const already = Boolean(bookmarkedIds[video.id]);
    const next = !already;
    setBookmarkedIds((prev) => ({ ...prev, [video.id]: next }));

    setVideos((prev) =>
      prev.map((item) =>
        item.id === video.id
          ? {
              ...item,
              stats: {
                ...item.stats,
                bookmarks: (item.stats.bookmarks || 0) + (next ? 1 : -1),
              },
            }
          : item
      )
    );

    showToast(next ? 'Saved to Favorites' : 'Removed from Favorites');
    fetch(`/api/videos/${encodeURIComponent(video.id)}/interact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': authToken,
      },
      body: JSON.stringify({ type: next ? 'bookmark' : 'unbookmark' }),
    }).catch(() => {});
  };

  const handleFollowCreator = async (rawHandle: string, displayName?: string) => {
    const clean = rawHandle.replace(/^@/, '').toLowerCase();
    const withAt = `@${clean}`;
    const nextState = !Boolean(followedHandles[clean] || followedHandles[withAt]);
    setFollowedHandles((prev) => ({
      ...prev,
      [clean]: nextState,
      [withAt]: nextState,
    }));
    if (displayName) {
      showToast(nextState ? `Following ${displayName}` : `Unfollowed ${displayName}`);
    }
    if (authToken) {
      try {
        await fetch('/api/follow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': authToken,
          },
          body: JSON.stringify({ handle: withAt }),
        });
      } catch {}
    }
  };

  const handleVideoTap = (e: React.MouseEvent<HTMLDivElement>, video: VideoFeedItem) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (now - lastTapRef.current < 280) {
      const newHeart: FloatingHeart = { id: Date.now() + Math.random(), x, y };
      setFloatingHearts((prev) => [...prev, newHeart]);
      setTimeout(() => {
        setFloatingHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
      }, 750);
      handleLikeToggle(video, true);
    } else {
      const vid = activeVideoRef.current;
      if (vid) {
        vid.volume = 1.0;
        boostVideoAudio(vid);
        if (vid.muted) {
          vid.muted = false;
          setIsMuted(false);
        }
        if (vid.paused) {
          vid.play().catch(() => {});
          setIsPlaying(true);
        } else {
          vid.pause();
          setIsPlaying(false);
        }
      }
    }
    lastTapRef.current = now;
  };

  const handleDownloadNoWatermark = (video: VideoFeedItem) => {
    showToast('Saving Video...');
    const a = document.createElement('a');
    a.href = video.videoUrl;
    a.download = `TurboTok-${video.id}.mp4`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Phone Number + @Username Sign Up & Log In Handler (Recovers account even after mobile reset!)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (authMode === 'signup') {
      if (!editHandle.trim() && !authPhone.trim()) {
        setAuthError('Apna Phone Number (03xx...) ya TikTok @username likhein.');
        return;
      }
    } else {
      if (!editHandle.trim() && !authPhone.trim()) {
        setAuthError('Apna Phone Number ya @username likhein (maslan @barkatalu23).');
        return;
      }
    }

    setIsAuthSubmitting(true);
    try {
      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          handle: editHandle.trim(),
          phone: authPhone.trim(),
          handleOrPhone: editHandle.trim() || authPhone.trim(),
          password: authPassword.trim() || '1234',
          bio: editBio.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.token || !data.profile) {
        setAuthError(data.error || 'Account open nahi ho saka.');
        return;
      }

      try {
        localStorage.setItem('turbotok_auth_token', data.token);
      } catch {}
      setAuthToken(data.token);
      setProfile(data.profile);
      setEditName(data.profile.name);
      setEditHandle(data.profile.handle);
      setEditPhone(data.profile.phone || '');
      setEditBio(data.profile.bio || '');
      if (Array.isArray(data.uploadedVideos)) {
        setMyAccountVideos(data.uploadedVideos);
      }
      setAuthPassword('');
      setAuthError('');
      setIsAccountDrawerOpen(false);
      fetchFeedPage(activeCategory, 1, false);
      showToast(`Logged into ${data.profile.handle}!`);
    } catch {
      setAuthError('Network error. Dobara koshish karein.');
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      showToast('Please enter your nickname');
      return;
    }
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          bio: editBio,
          avatar: profile?.avatar || '',
        }),
      });
      const data = await res.json();
      if (data?.profile) {
        setProfile(data.profile);
        setIsEditingProfile(false);
        showToast('Profile Updated!');
      }
    } catch {
      showToast('Could not update profile');
    }
  };

  const handleLogoutProfile = async () => {
    await fetch('/api/profile', {
      method: 'DELETE',
      headers: { 'x-auth-token': authToken },
    });
    try {
      localStorage.setItem('turbotok_auth_token', 'logged-out');
    } catch {}
    setAuthToken('logged-out');
    setProfile(null);
    setMyAccountVideos([]);
    setEditName('');
    setEditHandle('@barkatalu23');
    setAuthPhone('03000000023');
    setEditBio('');
    setAuthPassword('');
    setAuthMode('login');
    setIsAccountDrawerOpen(false);
    showToast('Logged out. Enter Phone or @username to log back in.');
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const newAvatar = reader.result;
        setProfile((prev) => (prev ? { ...prev, avatar: newAvatar } : prev));
        await fetch('/api/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': authToken,
          },
          body: JSON.stringify({
            name: profile?.name || editName || 'User',
            avatar: newAvatar,
          }),
        });
        showToast('Profile Photo Updated!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteUploadedVideo = async (videoId: string) => {
    const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
      headers: { 'x-auth-token': authToken },
    });
    if (res.ok) {
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      setMyAccountVideos((prev) => prev.filter((v) => v.id !== videoId));
      showToast('Video deleted');
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activeVideo) return;

    const text = commentText.trim();
    setCommentText('');

    const newComment: CommentItem = {
      id: `cmt-${Date.now()}`,
      user: profile?.name || 'User',
      handle: profile?.handle || '@user',
      text,
      createdAt: 'Just now',
      likes: 0,
    };

    setCommentsByVideo((prev) => ({
      ...prev,
      [activeVideo.id]: [newComment, ...(prev[activeVideo.id] || [])],
    }));

    setVideos((prev) =>
      prev.map((v) =>
        v.id === activeVideo.id
          ? { ...v, stats: { ...v.stats, comments: v.stats.comments + 1 } }
          : v
      )
    );

    fetch(`/api/videos/${encodeURIComponent(activeVideo.id)}/interact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': authToken,
      },
      body: JSON.stringify({ type: 'comment', commentText: text, userName: profile?.name || 'User' }),
    }).catch(() => {});
  };

  const myUploadedVideos = profile
    ? [
        ...myAccountVideos,
        ...videos.filter(
          (v) =>
            v.sourceEngine === 'creator-upload' &&
            v.author.handle.toLowerCase() === profile.handle.toLowerCase() &&
            !myAccountVideos.some((m) => m.id === v.id)
        ),
      ]
    : [];
  const myLikedVideos = videos.filter((v) => likedIds[v.id]);
  const mySavedVideos = videos.filter((v) => bookmarkedIds[v.id]);
  const activeComments = activeVideo ? commentsByVideo[activeVideo.id] || [] : [];

  const isLightBottomBar = activeScreen !== 'feed';

  return (
    <div className="h-[100dvh] w-full bg-black text-[#F8FAFC] flex flex-col overflow-hidden select-none">
      {toastNotice && (
        <div className="fixed top-15 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#161823] border border-white/15 text-xs font-semibold text-white shadow-2xl whitespace-nowrap">
          {toastNotice}
        </div>
      )}

      <div className="flex-1 min-h-0 w-full max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Desktop Left Sidebar */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col justify-between p-6 border-r border-white/10 bg-[#090A0F]">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="font-display text-xl font-extrabold tracking-tight text-white">
                TikTok
              </span>
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-semibold text-white cursor-pointer"
              >
                {isMuted ? 'Unmute' : 'Sound 200%'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                stopAllMediaImmediately();
                setActiveScreen('search-input');
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#131620] border border-white/10 hover:border-white/25 text-xs text-[#94A3B8] flex items-center justify-between cursor-pointer"
            >
              <span className="truncate">
                {activeSearchQuery || 'Search anything on TikTok...'}
              </span>
              <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 shrink-0 text-white">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveScreen('feed')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  activeScreen === 'feed'
                    ? 'bg-[#FE2C55] text-white'
                    : 'text-[#94A3B8] hover:bg-white/5 hover:text-white'
                }`}
              >
                For You Feed
              </button>
              <button
                type="button"
                onClick={() => {
                  stopAllMediaImmediately();
                  setActiveScreen('my-profile');
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  activeScreen === 'my-profile'
                    ? 'bg-white text-[#161823]'
                    : 'text-[#94A3B8] hover:bg-white/5 hover:text-white'
                }`}
              >
                {profile ? `Me (${profile.handle})` : 'Me (Sign In)'}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="w-full py-2.5 px-4 rounded-xl bg-[#FE2C55] hover:bg-[#e02449] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              + Upload Video
            </button>
          </div>
        </aside>

        {/* Center Mobile/Main Viewport */}
        <main className="col-span-1 lg:col-span-5 relative h-full w-full flex items-center justify-center bg-black overflow-hidden">
          {/* =====================================================================
              SCREEN 1: MAIN VERTICAL VIDEO FEED
             ===================================================================== */}
          {activeScreen === 'feed' && (
            <div className="relative w-full max-w-[430px] h-full pb-13 lg:pb-0 overflow-hidden bg-black">
              {/* Top Floating Header */}
              <header className="absolute top-0 left-0 right-0 z-30 h-13 px-4 flex items-center justify-between bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none">
                <button
                  type="button"
                  onClick={() => setIsMuted((m) => !m)}
                  className="pointer-events-auto min-w-[38px] min-h-[38px] flex items-center justify-center text-white cursor-pointer"
                >
                  {isMuted ? (
                    <span className="px-2 py-0.5 rounded bg-[#FE2C55] text-[10px] font-bold">
                      Unmute
                    </span>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white drop-shadow">
                      <path
                        d="M11 5L6 9H2V15H6L11 19V5Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M15.54 8.46a5 5 0 0 1 0 7.07"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </button>

                <nav className="pointer-events-auto flex items-center gap-5">
                  {TOP_TABS.map((tab) => {
                    const isActive = activeCategory === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveCategory(tab.id)}
                        className={`relative py-1.5 text-[15px] tracking-tight transition-colors cursor-pointer whitespace-nowrap drop-shadow ${
                          isActive
                            ? 'text-white font-bold'
                            : 'text-white/65 font-semibold hover:text-white/90'
                        }`}
                      >
                        {tab.label}
                        {isActive && (
                          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-[3px] rounded-full bg-white" />
                        )}
                      </button>
                    );
                  })}
                </nav>

                {/* Top-Right Search Icon */}
                <button
                  type="button"
                  onClick={() => {
                    stopAllMediaImmediately();
                    setActiveScreen('search-input');
                  }}
                  aria-label="Search"
                  className="pointer-events-auto min-w-[38px] min-h-[38px] flex items-center justify-center text-white cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 drop-shadow">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.3" />
                    <path
                      d="M16.5 16.5L21 21"
                      stroke="currentColor"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </header>

              {/* Native C++ GPU Scroll Container */}
              <div
                ref={feedScrollRef}
                className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {isLoading ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-10 h-10 rounded-full border-2 border-[#25F4EE] border-t-transparent animate-spin mb-3" />
                    <p className="text-sm font-semibold text-white">Loading Videos...</p>
                  </div>
                ) : loadError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                    <p className="text-sm text-white/90 mb-4">{loadError}</p>
                    <button
                      type="button"
                      onClick={() => fetchFeedPage(activeCategory, 1, false)}
                      className="px-5 py-2.5 rounded-xl bg-[#FE2C55] text-white text-xs font-semibold cursor-pointer"
                    >
                      Retry Feed
                    </button>
                  </div>
                ) : (
                  videos.map((video, idx) => {
                    const isSlideActive = idx === activeIndex;
                    const isNear = Math.abs(idx - activeIndex) <= 1;
                    const isLiked = Boolean(likedIds[video.id]);
                    const isBookmarked = Boolean(bookmarkedIds[video.id]);
                    const isFollowed = Boolean(
                      followedHandles[video.author.handle] ||
                        followedHandles[video.author.handle.replace(/^@/, '')]
                    );

                    return (
                      <section
                        key={video.id}
                        data-slide="true"
                        data-index={idx}
                        className="relative w-full h-full snap-start snap-always shrink-0 overflow-hidden bg-black flex items-center justify-center"
                      >
                        {isNear && video.posterUrl && (
                          <img
                            src={video.posterUrl}
                            alt={video.caption}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover opacity-85"
                          />
                        )}

                        {isSlideActive && isAppInForeground && (
                          <>
                            {video.sourceEngine === 'youtube-short' && video.youtubeId ? (
                              <iframe
                                src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&mute=${
                                  isMuted ? 1 : 0
                                }&controls=0&loop=1&playlist=${
                                  video.youtubeId
                                }&playsinline=1&rel=0&modestbranding=1`}
                                title={video.caption}
                                allow="autoplay; encrypted-media; picture-in-picture"
                                className="relative z-5 w-full h-full border-0 object-cover pointer-events-none scale-[1.03]"
                              />
                            ) : (
                              <video
                                ref={activeVideoRef}
                                src={video.videoUrl}
                                poster={video.posterUrl}
                                onPlay={(e) => boostVideoAudio(e.currentTarget)}
                                className="relative z-5 w-full h-full object-cover"
                                playsInline
                                loop
                                autoPlay
                                muted={isMuted}
                                preload="auto"
                              />
                            )}
                          </>
                        )}

                        {isNear && (
                          <>
                            <div
                              onClick={(e) => handleVideoTap(e, video)}
                              className="absolute inset-0 z-10 cursor-pointer"
                            >
                              {isSlideActive &&
                                floatingHearts.map((heart) => (
                                  <div
                                    key={heart.id}
                                    style={{ left: heart.x, top: heart.y }}
                                    className="absolute pointer-events-none animate-heart-burst z-30"
                                  >
                                    <TikTokHeartIcon className="w-20 h-20 drop-shadow-2xl" active />
                                  </div>
                                ))}

                              {!isPlaying && isSlideActive && video.sourceEngine !== 'youtube-short' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/25 pointer-events-none">
                                  <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" fill="white" className="w-9 h-9 ml-1">
                                      <path d="M8 5.14v14l11-7-11-7z" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Right-Side Action Rail */}
                            <div className="absolute right-2.5 bottom-12 z-20 flex flex-col items-center gap-3.5">
                              {/* Creator Avatar */}
                              <div className="relative mb-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCreatorProfile(
                                      video.author.name,
                                      video.author.handle,
                                      video.author.avatar || video.posterUrl || ''
                                    );
                                  }}
                                  className="w-12 h-12 rounded-full bg-[#131620] border-2 border-white overflow-hidden shadow-lg flex items-center justify-center cursor-pointer"
                                >
                                  {video.author.avatar ? (
                                    <img
                                      src={video.author.avatar}
                                      alt={video.author.name}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-xs font-bold text-white">
                                      {video.author.name.slice(0, 2).toUpperCase()}
                                    </span>
                                  )}
                                </button>
                                {!isFollowed && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFollowCreator(video.author.handle, video.author.name);
                                    }}
                                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#FE2C55] text-white flex items-center justify-center shadow cursor-pointer"
                                  >
                                    <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
                                      <path
                                        d="M8 3.5V12.5M3.5 8H12.5"
                                        stroke="white"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>

                              {/* Heart */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLikeToggle(video);
                                }}
                                className="min-w-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                              >
                                <TikTokHeartIcon
                                  className="w-8 h-8 drop-shadow-md group-active:scale-125"
                                  active={isLiked}
                                />
                                <span className="text-[12px] font-semibold text-white font-mono-num drop-shadow">
                                  {formatCompactCount(video.stats.likes)}
                                </span>
                              </button>

                              {/* Comment */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsMobileCommentsOpen(true);
                                }}
                                className="min-w-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                              >
                                <TikTokCommentIcon className="w-8 h-8 drop-shadow-md group-active:scale-110 transition-transform" />
                                <span className="text-[12px] font-semibold text-white font-mono-num drop-shadow">
                                  {formatCompactCount(video.stats.comments)}
                                </span>
                              </button>

                              {/* Bookmark */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBookmarkToggle(video);
                                }}
                                className="min-w-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                              >
                                <TikTokBookmarkIcon
                                  className="w-8 h-8 drop-shadow-md group-active:scale-110"
                                  active={isBookmarked}
                                />
                                <span className="text-[12px] font-semibold text-white font-mono-num drop-shadow">
                                  {formatCompactCount(video.stats.bookmarks ?? 0)}
                                </span>
                              </button>

                              {/* Share */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShareVideo(video);
                                }}
                                className="min-w-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                              >
                                <TikTokShareArrowIcon className="w-8 h-8 drop-shadow-md group-active:scale-110 transition-transform" />
                                <span className="text-[12px] font-semibold text-white font-mono-num drop-shadow">
                                  {formatCompactCount(video.stats.shares)}
                                </span>
                              </button>

                              <div className="mt-1">
                                <SpinningVinylDisc
                                  isPlaying={isSlideActive && isPlaying}
                                  authorName={video.author.name}
                                />
                              </div>
                            </div>

                            {/* Bottom Creator Info */}
                            <div className="absolute inset-x-0 bottom-0 z-15 pt-16 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none">
                              <div className="px-3.5 pr-18 pb-2.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCreatorProfile(
                                      video.author.name,
                                      video.author.handle,
                                      video.author.avatar || video.posterUrl || ''
                                    );
                                  }}
                                  className="pointer-events-auto flex items-center gap-1.5 mb-1 cursor-pointer text-left"
                                >
                                  <span className="font-bold text-[15px] text-white hover:underline drop-shadow">
                                    {video.author.name}
                                  </span>
                                  {video.author.verified && <VerifiedBadgeIcon className="w-4 h-4" />}
                                </button>

                                <p className="text-[13px] text-white/95 line-clamp-2 leading-snug drop-shadow">
                                  {video.caption}
                                </p>

                                <div className="flex items-center gap-2 text-xs text-white/85 mt-2">
                                  <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5 shrink-0">
                                    <path
                                      d="M7 15V4L16 2.5V13.5"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <circle cx="5" cy="15" r="2" stroke="currentColor" strokeWidth="1.8" />
                                    <circle cx="14" cy="13.5" r="2" stroke="currentColor" strokeWidth="1.8" />
                                  </svg>
                                  <span className="truncate">{video.music.title}</span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stopAllMediaImmediately();
                                  setSearchInput('');
                                  setActiveScreen('search-input');
                                }}
                                className="pointer-events-auto w-full h-8 px-3.5 bg-black/65 border-t border-white/10 flex items-center justify-between text-xs text-white/90 hover:text-white cursor-pointer"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5 shrink-0 text-white/80">
                                    <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                                    <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  </svg>
                                  <span className="truncate">
                                    Search · {video.searchHint || video.caption.slice(0, 32)}
                                  </span>
                                </div>
                                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 shrink-0 text-white/60">
                                  <path
                                    d="M6 3.5L10.5 8L6 12.5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </>
                        )}
                      </section>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              SCREEN 2: CLEAN TIKTOK SEARCH INPUT
             ===================================================================== */}
          {activeScreen === 'search-input' && (
            <div className="w-full max-w-[430px] h-full pb-13 lg:pb-0 bg-white text-[#161823] flex flex-col overflow-hidden">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  executeSearchToGrid(searchInput);
                }}
                className="h-14 px-3 flex items-center gap-2.5 shrink-0 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setActiveScreen('feed')}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#161823] cursor-pointer"
                  aria-label="Back"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                    <path
                      d="M19 12H5M12 19l-7-7 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <div className="flex-1 h-9 bg-[#F1F1F2] rounded-md px-3 flex items-center gap-2">
                  <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 text-[#8A8B91] shrink-0">
                    <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                    <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    autoFocus
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search"
                    className="flex-1 bg-transparent text-[15px] text-[#161823] placeholder-[#8A8B91] focus:outline-none"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => setSearchInput('')}
                      className="w-4 h-4 rounded-full bg-[#8A8B91]/60 text-white text-[10px] flex items-center justify-center cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  className="px-1 text-[15px] font-semibold text-[#FE2C55] cursor-pointer shrink-0"
                >
                  Search
                </button>
              </form>

              <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
                {suggestKeywords.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => executeSearchToGrid(kw)}
                    className="w-full py-1.5 text-left text-[16px] font-normal text-[#161823] hover:opacity-70 block cursor-pointer"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* =====================================================================
              SCREEN 3: TIKTOK SEARCH RESULTS 2-COLUMN GRID
             ===================================================================== */}
          {activeScreen === 'search-results' && (
            <div className="w-full max-w-[430px] h-full pb-13 lg:pb-0 bg-white text-[#161823] flex flex-col overflow-hidden">
              <div className="h-13 px-3 flex items-center gap-2.5 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setActiveScreen('feed')}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#161823] cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                    <path
                      d="M19 12H5M12 19l-7-7 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                <div
                  onClick={() => setActiveScreen('search-input')}
                  className="flex-1 h-9 bg-[#F1F1F2] rounded-md px-3 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 text-[#8A8B91] shrink-0">
                      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
                      <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="text-[15px] text-[#161823] truncate">{activeSearchQuery}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchInput('');
                      setActiveScreen('search-input');
                    }}
                    className="w-4 h-4 rounded-full bg-[#8A8B91]/60 text-white text-[10px] flex items-center justify-center shrink-0"
                  >
                    ✕
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveScreen('search-input')}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#161823] cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                    <path d="M4 7h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="9" cy="7" r="2.5" fill="white" stroke="currentColor" strokeWidth="2" />
                    <circle cx="15" cy="17" r="2.5" fill="white" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              </div>

              {/* Tabs Row: Top | Users | Videos | Sounds | Hashtags */}
              <div className="h-10 px-4 border-b border-black/10 flex items-center justify-between text-[14px] font-semibold shrink-0 bg-white">
                {(
                  [
                    { id: 'top', label: 'Top' },
                    { id: 'users', label: 'Users' },
                    { id: 'videos', label: 'Videos' },
                    { id: 'sounds', label: 'Sounds' },
                    { id: 'hashtags', label: 'Hashtags' },
                  ] as const
                ).map((t) => {
                  const active = searchTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSearchTab(t.id)}
                      className={`h-full relative px-1 flex items-center cursor-pointer ${
                        active ? 'text-[#161823] font-bold' : 'text-[#8A8B91]'
                      }`}
                    >
                      {t.label}
                      {active && (
                        <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#161823]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Results Content */}
              <div className="flex-1 overflow-y-auto p-2 bg-white">
                {isSearchingResults ? (
                  <div className="py-16 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-[#FE2C55] border-t-transparent animate-spin mb-2" />
                    <p className="text-xs text-[#8A8B91]">Searching "{activeSearchQuery}"...</p>
                  </div>
                ) : searchTab === 'users' ? (
                  <div className="divide-y divide-black/5 px-2">
                    {searchResultUsers.map((u) => (
                      <div
                        key={u.handle}
                        onClick={() => openCreatorProfile(u.name, u.handle, u.avatar)}
                        className="py-3 flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover bg-gray-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#161823] truncate">{u.name}</p>
                            <p className="text-xs text-[#8A8B91] truncate">@{u.handle}</p>
                            <p className="text-[11px] text-[#8A8B91]">
                              {formatCompactCount(u.followers)} Followers
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreatorProfile(u.name, u.handle, u.avatar);
                          }}
                          className="px-4 py-1.5 rounded-md bg-[#FE2C55] text-white text-xs font-semibold cursor-pointer shrink-0"
                        >
                          View Profile
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {searchResultVideos.map((vid, idx) => (
                      <div key={vid.id} className="flex flex-col pb-2">
                        <div
                          onClick={() => playVideosListAt(searchResultVideos, idx)}
                          className="relative aspect-[9/14] rounded-md overflow-hidden bg-black cursor-pointer"
                        >
                          {vid.posterUrl && (
                            <img
                              src={vid.posterUrl}
                              alt={vid.caption}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          )}
                          <span className="absolute bottom-2 left-2 text-[12px] font-semibold text-white drop-shadow">
                            {vid.publishedAgo || '1d ago'}
                          </span>
                        </div>

                        <p
                          onClick={() => playVideosListAt(searchResultVideos, idx)}
                          className="text-[13.5px] text-[#161823] font-normal line-clamp-2 leading-snug mt-1.5 px-0.5 cursor-pointer"
                        >
                          {vid.caption}
                        </p>

                        <div className="flex items-center justify-between mt-1.5 px-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              openCreatorProfile(
                                vid.author.name,
                                vid.author.handle,
                                vid.author.avatar || vid.posterUrl || ''
                              )
                            }
                            className="flex items-center gap-1.5 min-w-0 cursor-pointer text-left"
                          >
                            {vid.author.avatar ? (
                              <img
                                src={vid.author.avatar}
                                alt={vid.author.name}
                                referrerPolicy="no-referrer"
                                className="w-5 h-5 rounded-full object-cover shrink-0 bg-gray-200"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-300 shrink-0" />
                            )}
                            <span className="text-[12px] text-[#56575E] truncate hover:underline">
                              {vid.author.name}
                            </span>
                          </button>

                          <div className="flex items-center gap-1 text-[12px] text-[#56575E] shrink-0">
                            <svg viewBox="0 0 20 20" fill="none" className="w-3.5 h-3.5">
                              <path
                                d="M10 17.2L8.8 16.1C4.5 12.2 1.7 9.6 1.7 6.5C1.7 3.9 3.7 1.9 6.3 1.9C7.7 1.9 9.1 2.6 10 3.6C10.9 2.6 12.3 1.9 13.7 1.9C16.3 1.9 18.3 3.9 18.3 6.5C18.3 9.6 15.5 12.2 11.2 16.1L10 17.2Z"
                                stroke="currentColor"
                                strokeWidth="1.6"
                              />
                            </svg>
                            <span>{formatCompactCount(vid.stats.likes)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =====================================================================
              SCREEN 4: OTHER CREATOR'S PUBLIC PROFILE (White TikTok Profile UI)
             ===================================================================== */}
          {activeScreen === 'creator-profile' && viewedCreator && (
            <div className="w-full max-w-[430px] h-full pb-14 lg:pb-0 bg-white text-[#161823] flex flex-col overflow-y-auto">
              <div className="h-12 px-4 flex items-center justify-between shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setActiveScreen('feed')}
                  className="text-sm font-semibold text-[#161823] cursor-pointer flex items-center gap-1"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                    <path
                      d="M19 12H5M12 19l-7-7 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="font-bold text-[15px] text-[#161823] truncate">
                  {viewedCreator.name}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveScreen('search-input')}
                  className="text-[#161823] cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="px-4 pt-2 pb-4 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-[#F1F1F2] overflow-hidden mb-3 flex items-center justify-center shadow-sm">
                  {viewedCreator.avatar ? (
                    <img
                      src={viewedCreator.avatar}
                      alt={viewedCreator.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-[#161823]">
                      {viewedCreator.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <h1 className="text-[17px] font-bold text-[#161823]">{viewedCreator.name}</h1>
                <p className="text-[13px] text-[#8A8B91] mt-0.5">@{viewedCreator.handle}</p>

                <div className="flex items-center justify-center gap-6 my-4">
                  <div className="text-center">
                    <p className="text-[17px] font-bold text-[#161823]">
                      {formatCompactCount(viewedCreator.followingCount ?? 14)}
                    </p>
                    <p className="text-[12px] text-[#8A8B91]">Following</p>
                  </div>
                  <div className="h-4 w-[1px] bg-black/10" />
                  <div className="text-center">
                    <p className="text-[17px] font-bold text-[#161823]">
                      {formatCompactCount(viewedCreator.followers ?? 0)}
                    </p>
                    <p className="text-[12px] text-[#8A8B91]">Follower</p>
                  </div>
                  <div className="h-4 w-[1px] bg-black/10" />
                  <div className="text-center">
                    <p className="text-[17px] font-bold text-[#161823]">
                      {formatCompactCount(viewedCreator.totalLikes ?? 0)}
                    </p>
                    <p className="text-[12px] text-[#8A8B91]">Likes</p>
                  </div>
                </div>

                {viewedCreator.bio && (
                  <p className="text-[13px] text-[#161823] mb-3 max-w-[260px]">{viewedCreator.bio}</p>
                )}

                <button
                  type="button"
                  onClick={() => handleFollowCreator(viewedCreator.handle, viewedCreator.name)}
                  className={`w-44 py-2.5 rounded-md text-[14px] font-semibold cursor-pointer transition-colors ${
                    followedHandles[viewedCreator.handle] ||
                    followedHandles[`@${viewedCreator.handle}`]
                      ? 'bg-[#F1F1F2] text-[#161823]'
                      : 'bg-[#FE2C55] text-white'
                  }`}
                >
                  {followedHandles[viewedCreator.handle] ||
                  followedHandles[`@${viewedCreator.handle}`]
                    ? 'Following'
                    : 'Follow'}
                </button>
              </div>

              <div className="h-10 border-t border-b border-black/10 flex items-center justify-around shrink-0">
                <div className="h-full px-6 flex items-center border-b-2 border-[#161823]">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#161823]">
                    <path d="M4 5v14M10 5v14M16 5v14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              {isLoadingCreator ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-[#FE2C55] border-t-transparent animate-spin mb-2" />
                  <p className="text-xs text-[#8A8B91]">Loading videos...</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-[1.5px] bg-white">
                  {creatorVideos.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => playVideosListAt(creatorVideos, idx)}
                      className="relative aspect-[3/4] bg-[#F1F1F2] overflow-hidden cursor-pointer"
                    >
                      {item.posterUrl && (
                        <img
                          src={item.posterUrl}
                          alt={item.caption}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent flex items-center gap-1">
                        <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-white">
                          <path
                            d="M4.5 3L12.5 8L4.5 13V3Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="text-[12px] font-semibold text-white">
                          {formatCompactCount(item.stats.views)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              SCREEN 5: MY REAL TIKTOK PROFILE (EXACT 1:1 MATCH TO SCREENSHOT 1!)
              White Background, @barkatalu23, 1.4K Following | 850 Follower | 106 Likes,
              Offline videos & Media player pills, 4 Tabs, 3-Column Tight Video Grid!
             ===================================================================== */}
          {activeScreen === 'my-profile' && (
            <div className="w-full max-w-[430px] h-full pb-14 lg:pb-0 bg-white text-[#161823] flex flex-col overflow-y-auto">
              {!profile ? (
                /* PHONE NUMBER + @USERNAME TIKTOK SIGN IN / CREATE ACCOUNT SCREEN */
                <div className="w-full h-full bg-white text-[#161823] flex flex-col p-6 overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <button
                      type="button"
                      onClick={() => setActiveScreen('feed')}
                      className="text-sm font-semibold text-[#8A8B91] hover:text-[#161823] cursor-pointer"
                    >
                      ← Back
                    </button>
                    <span className="text-xs font-bold text-[#161823]">TikTok Account</span>
                  </div>

                  <div className="grid grid-cols-2 p-1 rounded-xl bg-[#F1F1F2] mb-6">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError('');
                      }}
                      className={`py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        authMode === 'login'
                          ? 'bg-white text-[#161823] shadow-sm'
                          : 'text-[#8A8B91]'
                      }`}
                    >
                      Log In (Phone / @User)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthError('');
                      }}
                      className={`py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        authMode === 'signup'
                          ? 'bg-white text-[#161823] shadow-sm'
                          : 'text-[#8A8B91]'
                      }`}
                    >
                      Create Account (Phone)
                    </button>
                  </div>

                  <h1 className="text-xl font-extrabold text-[#161823] mb-1.5">
                    {authMode === 'login'
                      ? 'Log in with Phone Number or @Username'
                      : 'Create TikTok Account with Phone'}
                  </h1>
                  <p className="text-xs text-[#8A8B91] mb-6 leading-relaxed">
                    Aapka account Cloud Server par mehfooz rehta hai — agar mobile reset bhi ho jaye, to apna Phone Number ya @username (maslan @barkatalu23) likh kar wapas khol sakte hain.
                  </p>

                  <form onSubmit={handleAuthSubmit} className="space-y-4">
                    <div className="border-b border-black/15 pb-2">
                      <label className="block text-[11px] font-semibold text-[#8A8B91] mb-1">
                        Phone Number (PK +92 / 03xx)
                      </label>
                      <input
                        type="tel"
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value)}
                        placeholder="e.g. 03001234567"
                        className="w-full text-sm text-[#161823] placeholder-[#8A8B91] focus:outline-none"
                      />
                    </div>

                    <div className="border-b border-black/15 pb-2">
                      <label className="block text-[11px] font-semibold text-[#8A8B91] mb-1">
                        TikTok @Username (Real TikTok Sync)
                      </label>
                      <input
                        type="text"
                        maxLength={30}
                        value={editHandle}
                        onChange={(e) => setEditHandle(e.target.value)}
                        placeholder="e.g. @barkatalu23"
                        className="w-full text-sm text-[#161823] placeholder-[#8A8B91] focus:outline-none"
                      />
                    </div>

                    {authMode === 'signup' && (
                      <div className="border-b border-black/15 pb-2">
                        <label className="block text-[11px] font-semibold text-[#8A8B91] mb-1">
                          Display Name (Optional)
                        </label>
                        <input
                          type="text"
                          maxLength={30}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="e.g. 😄 everyone is happy"
                          className="w-full text-sm text-[#161823] placeholder-[#8A8B91] focus:outline-none"
                        />
                      </div>
                    )}

                    <div className="border-b border-black/15 pb-2">
                      <label className="block text-[11px] font-semibold text-[#8A8B91] mb-1">
                        Password / PIN
                      </label>
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="Enter PIN / Password (default: 1234)"
                        className="w-full text-sm text-[#161823] placeholder-[#8A8B91] focus:outline-none"
                      />
                    </div>

                    {authError && (
                      <div className="p-3 rounded-lg bg-[#FE2C55]/10 border border-[#FE2C55]/30 text-xs font-semibold text-[#FE2C55]">
                        {authError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isAuthSubmitting}
                      className="w-full py-3.5 rounded-lg bg-[#FE2C55] hover:bg-[#e02449] text-white text-sm font-bold cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {isAuthSubmitting
                        ? 'Syncing TikTok Account...'
                        : authMode === 'login'
                        ? 'Log In & Restore Account'
                        : 'Create & Sync Account'}
                    </button>
                  </form>
                </div>
              ) : (
                <>
                  {/* Top Bar: Left Add Friend icon, Right Eye + 3-Dots icon (Exact Match to Screenshot 1!) */}
                  <div className="h-12 px-4 flex items-center justify-between shrink-0 bg-white">
                    <button
                      type="button"
                      onClick={() => setIsAccountDrawerOpen(true)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-start text-[#161823] cursor-pointer"
                      title="Switch Account / Phone Number Login"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                        <circle cx="10" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                        <path
                          d="M3 20c1.6-3.2 4.3-4.5 7-4.5s5.4 1.3 7 4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M19 8v6M16 11h6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>

                    <div className="flex items-center gap-4">
                      {/* Eye Icon */}
                      <button
                        type="button"
                        onClick={() => showToast('Profile Views: Active')}
                        className="text-[#161823] cursor-pointer"
                      >
                        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                          <path
                            d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </button>

                      {/* 3 Vertical Dots Icon -> Account / Phone Settings */}
                      <button
                        type="button"
                        onClick={() => setIsAccountDrawerOpen(true)}
                        className="text-[#161823] cursor-pointer"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                          <circle cx="12" cy="5" r="1.8" />
                          <circle cx="12" cy="12" r="1.8" />
                          <circle cx="12" cy="19" r="1.8" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Profile Header Section (Exact 1:1 Match to Screenshot 1!) */}
                  <div className="px-4 pt-1 pb-3 flex flex-col items-center text-center bg-white">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <div
                      onClick={() => avatarInputRef.current?.click()}
                      className="relative w-24 h-24 rounded-full cursor-pointer mb-3"
                    >
                      <div className="w-full h-full rounded-full bg-[#F1F1F2] overflow-hidden flex items-center justify-center border border-black/5">
                        {profile.avatar ? (
                          <img
                            src={profile.avatar}
                            alt={profile.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl font-bold text-[#161823]">
                            {profile.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      {/* Cyan + Badge on Bottom-Right of Avatar (Exact match to Screenshot 1!) */}
                      <span className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-[#20D5EC] border-2 border-white flex items-center justify-center shadow-sm">
                        <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                          <path
                            d="M8 3.5V12.5M3.5 8H12.5"
                            stroke="white"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    </div>

                    {/* Name + Edit Pill + QR Button Row (Exact match to Screenshot 1!) */}
                    <div className="flex items-center justify-center gap-2 max-w-full px-2">
                      <h1 className="text-[17px] font-bold text-[#161823] truncate max-w-[190px]">
                        {profile.name}
                      </h1>
                      <button
                        type="button"
                        onClick={() => {
                          setEditName(profile.name);
                          setEditHandle(profile.handle);
                          setEditPhone(profile.phone || '');
                          setEditBio(profile.bio);
                          setIsEditingProfile((prev) => !prev);
                        }}
                        className="px-4 py-1.5 rounded-full bg-[#F1F1F2] hover:bg-[#E4E4E6] text-[13px] font-semibold text-[#161823] cursor-pointer shrink-0"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAccountDrawerOpen(true)}
                        className="w-8 h-8 rounded-full bg-[#F1F1F2] hover:bg-[#E4E4E6] flex items-center justify-center text-[#161823] cursor-pointer shrink-0"
                        title="Account & Phone Number"
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
                          <rect x="3" y="3" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.7" />
                          <rect x="11.5" y="3" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.7" />
                          <rect x="3" y="11.5" width="5.5" height="5.5" stroke="currentColor" strokeWidth="1.7" />
                          <path d="M11.5 11.5h2.5v2.5M14 14h3v3h-3M17 11.5v1" stroke="currentColor" strokeWidth="1.7" />
                        </svg>
                      </button>
                    </div>

                    {/* @handle below name */}
                    <p className="text-[13px] text-[#8A8B91] mt-0.5">{profile.handle}</p>

                    {/* 3 Stats Row with Vertical Dividers (1.4K Following | 850 Follower | 106 Likes) */}
                    <div className="flex items-center justify-center gap-6 my-3.5">
                      <div className="text-center">
                        <p className="text-[17px] font-bold text-[#161823]">
                          {formatCompactCount(
                            profile.followingCount +
                              Object.values(followedHandles).filter(Boolean).length
                          )}
                        </p>
                        <p className="text-[12px] text-[#8A8B91]">Following</p>
                      </div>
                      <div className="h-4 w-[1px] bg-black/10" />
                      <div className="text-center">
                        <p className="text-[17px] font-bold text-[#161823]">
                          {formatCompactCount(profile.followersCount)}
                        </p>
                        <p className="text-[12px] text-[#8A8B91]">Follower</p>
                      </div>
                      <div className="h-4 w-[1px] bg-black/10" />
                      <div className="text-center">
                        <p className="text-[17px] font-bold text-[#161823]">
                          {formatCompactCount(
                            profile.likesCount ??
                              myUploadedVideos.reduce((acc, v) => acc + v.stats.likes, 0)
                          )}
                        </p>
                        <p className="text-[12px] text-[#8A8B91]">Likes</p>
                      </div>
                    </div>

                    {/* Bio Line */}
                    <p className="text-[13.5px] text-[#161823] mb-3.5">
                      {profile.bio || 'follow and like this account'}
                    </p>

                    {/* Two Gray Action Pills: Offline videos & Media player (Exact match to Screenshot 1!) */}
                    <div className="flex items-center justify-center gap-2.5 w-full max-w-[340px]">
                      <button
                        type="button"
                        onClick={() => setIsUploadOpen(true)}
                        className="flex-1 py-2 px-3.5 rounded-full bg-[#F1F1F2] hover:bg-[#E4E4E6] flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[#161823] cursor-pointer"
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 text-[#FE2C55] shrink-0">
                          <path
                            d="M6.5 14.5H5a3.5 3.5 0 0 1-.4-6.98A5 5 0 0 1 14.3 6a4 4 0 0 1 .7 7.94h-1.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                          <path
                            d="M10 9.5v6m0 0l-2-2m2 2l2-2"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>Offline videos</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (myUploadedVideos.length > 0) {
                            playVideosListAt(myUploadedVideos, 0);
                          } else {
                            setActiveScreen('feed');
                          }
                        }}
                        className="flex-1 py-2 px-3.5 rounded-full bg-[#F1F1F2] hover:bg-[#E4E4E6] flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[#161823] cursor-pointer"
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 text-[#FE2C55] shrink-0">
                          <path
                            d="M9 14.5V4.5l7-1.5v4l-7 1.5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx="6.5" cy="14.5" r="2.5" fill="currentColor" />
                        </svg>
                        <span>Media player</span>
                      </button>
                    </div>

                    {/* Inline Edit Profile Form when Edit is clicked */}
                    {isEditingProfile && (
                      <form
                        onSubmit={handleSaveProfile}
                        className="w-full mt-4 p-4 rounded-2xl bg-[#F8F8F9] border border-black/10 text-left space-y-3"
                      >
                        <div>
                          <label className="block text-[11px] font-semibold text-[#8A8B91] mb-1">
                            Display Name
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-black/15 text-xs text-[#161823]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#8A8B91] mb-1">
                            Linked Phone Number (for Account Recovery)
                          </label>
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="03001234567"
                            className="w-full px-3 py-2 rounded-lg bg-white border border-black/15 text-xs text-[#161823]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#8A8B91] mb-1">
                            Bio
                          </label>
                          <input
                            type="text"
                            value={editBio}
                            onChange={(e) => setEditBio(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-black/15 text-xs text-[#161823]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingProfile(false)}
                            className="flex-1 py-2 rounded-lg bg-black/10 text-[#161823] text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 py-2 rounded-lg bg-[#FE2C55] text-white text-xs font-bold cursor-pointer"
                          >
                            Save Changes
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* 4 Icon Tabs Row (Exact match to Screenshot 1: |||▾ | Bookmark | Heart-Eye | Lock) */}
                  <div className="h-11 border-t border-b border-black/10 grid grid-cols-4 items-center shrink-0 bg-white">
                    <button
                      type="button"
                      onClick={() => setProfileTab('uploaded')}
                      className={`h-full relative flex items-center justify-center gap-0.5 cursor-pointer ${
                        profileTab === 'uploaded' ? 'text-[#161823]' : 'text-[#8A8B91]'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                        <path
                          d="M5 5v14M10 5v14M15 5v14"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                        />
                        <path d="M18 10l2.5 3 2.5-3H18z" fill="currentColor" />
                      </svg>
                      {profileTab === 'uploaded' && (
                        <span className="absolute bottom-0 left-6 right-6 h-[2.5px] bg-[#161823]" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setProfileTab('saved')}
                      className={`h-full relative flex items-center justify-center cursor-pointer ${
                        profileTab === 'saved' ? 'text-[#161823]' : 'text-[#8A8B91]'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                        <path
                          d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {profileTab === 'saved' && (
                        <span className="absolute bottom-0 left-6 right-6 h-[2.5px] bg-[#161823]" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setProfileTab('liked')}
                      className={`h-full relative flex items-center justify-center cursor-pointer ${
                        profileTab === 'liked' ? 'text-[#161823]' : 'text-[#8A8B91]'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                        <path
                          d="M12 20.2L10.6 18.9C5.4 14.2 2 11.1 2 7.3C2 4.2 4.4 1.8 7.5 1.8C9.2 1.8 10.9 2.6 12 3.9C13.1 2.6 14.8 1.8 16.5 1.8C19.6 1.8 22 4.2 22 7.3C22 11.1 18.6 14.2 13.4 18.9L12 20.2Z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      {profileTab === 'liked' && (
                        <span className="absolute bottom-0 left-6 right-6 h-[2.5px] bg-[#161823]" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setProfileTab('private')}
                      className={`h-full relative flex items-center justify-center cursor-pointer ${
                        profileTab === 'private' ? 'text-[#161823]' : 'text-[#8A8B91]'
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                        <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
                        <path
                          d="M8 11V7a4 4 0 0 1 8 0v4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      {profileTab === 'private' && (
                        <span className="absolute bottom-0 left-6 right-6 h-[2.5px] bg-[#161823]" />
                      )}
                    </button>
                  </div>

                  {/* 3-Column Tight Video Grid (Exact match to Screenshot 1: aspect-[3/4] with ▷ 206 views at bottom-left!) */}
                  {(() => {
                    const activeList =
                      profileTab === 'uploaded'
                        ? myUploadedVideos
                        : profileTab === 'saved'
                        ? mySavedVideos
                        : profileTab === 'liked'
                        ? myLikedVideos
                        : [];

                    if (activeList.length === 0) {
                      return (
                        <div className="py-16 px-6 text-center">
                          <p className="text-xs text-[#8A8B91] mb-3">
                            {profileTab === 'uploaded'
                              ? 'No videos uploaded yet.'
                              : profileTab === 'saved'
                              ? 'No saved videos yet.'
                              : profileTab === 'liked'
                              ? 'No liked videos yet.'
                              : 'No private videos.'}
                          </p>
                          {profileTab === 'uploaded' && (
                            <button
                              type="button"
                              onClick={() => setIsUploadOpen(true)}
                              className="px-5 py-2 rounded-full bg-[#FE2C55] text-white text-xs font-bold cursor-pointer"
                            >
                              + Upload Video
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-3 gap-[1.5px] bg-white">
                        {activeList.map((item, idx) => (
                          <div
                            key={item.id}
                            onClick={() => playVideosListAt(activeList, idx)}
                            className="relative aspect-[3/4] bg-[#F1F1F2] overflow-hidden cursor-pointer"
                          >
                            {item.posterUrl ? (
                              <img
                                src={item.posterUrl}
                                alt={item.caption}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video
                                src={item.videoUrl}
                                className="w-full h-full object-cover"
                                muted
                                preload="metadata"
                              />
                            )}
                            {/* Play Triangle + View Count at Bottom-Left (▷ 206, ▷ 149, ▷ 188) */}
                            <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent flex items-center gap-1">
                              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-white">
                                <path
                                  d="M4.5 3L12.5 8L4.5 13V3Z"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span className="text-[12px] font-semibold text-white">
                                {formatCompactCount(item.stats.views)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* Mobile Bottom Navigation Bar (Matches Screenshot 1: Home | Explore | [+] | Inbox | Me) */}
          <nav
            className={`lg:hidden fixed bottom-0 left-0 right-0 h-13 z-30 border-t grid grid-cols-5 items-center px-1 ${
              isLightBottomBar
                ? 'bg-white border-black/10 text-[#161823]'
                : 'bg-black border-white/10 text-white'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveScreen('feed')}
              className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
                activeScreen === 'feed'
                  ? isLightBottomBar
                    ? 'text-[#161823] font-bold'
                    : 'text-white font-bold'
                  : isLightBottomBar
                  ? 'text-[#8A8B91]'
                  : 'text-white/65'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path
                  d="M4 10.5L12 3.5l8 7V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1v-9.5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[10px] mt-0.5">Home</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopAllMediaImmediately();
                setActiveScreen('search-input');
              }}
              className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
                activeScreen === 'search-input' || activeScreen === 'search-results'
                  ? isLightBottomBar
                    ? 'text-[#161823] font-bold'
                    : 'text-white font-bold'
                  : isLightBottomBar
                  ? 'text-[#8A8B91]'
                  : 'text-white/65'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="2" />
                <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="2" />
                <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="2" />
                <circle cx="16.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="2" />
                <path d="M19 19l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className="text-[10px] mt-0.5">Explore</span>
            </button>

            <div className="flex items-center justify-center">
              <TikTokCreatePlusButton onClick={() => setIsUploadOpen(true)} />
            </div>

            <button
              type="button"
              onClick={() => setIsMobileCommentsOpen(true)}
              className={`relative flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
                isLightBottomBar ? 'text-[#8A8B91]' : 'text-white/65'
              }`}
            >
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                  <rect x="4" y="4" width="16" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 10.5h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M10 17l2 3 2-3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-[#FE2C55]" />
              </div>
              <span className="text-[10px] mt-0.5">Inbox</span>
            </button>

            <button
              type="button"
              onClick={() => {
                stopAllMediaImmediately();
                setActiveScreen('my-profile');
              }}
              className={`flex flex-col items-center justify-center min-h-[44px] cursor-pointer ${
                activeScreen === 'my-profile'
                  ? isLightBottomBar
                    ? 'text-[#161823] font-bold'
                    : 'text-white font-bold'
                  : isLightBottomBar
                  ? 'text-[#8A8B91]'
                  : 'text-white/65'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill={activeScreen === 'my-profile' ? 'currentColor' : 'none'}
                className="w-5 h-5"
              >
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[10px] mt-0.5">Me</span>
            </button>
          </nav>
        </main>

        {/* Right Column (Desktop): Comments */}
        <aside className="hidden lg:flex lg:col-span-4 flex-col justify-between p-6 border-l border-white/10 bg-[#090A0F] overflow-hidden">
          {activeVideo ? (
            <>
              <div className="pb-4 border-b border-white/10">
                <h2 className="font-display text-sm font-bold text-white">
                  Comments ({formatCompactCount(activeVideo.stats.comments)})
                </h2>
                <p className="text-xs text-[#94A3B8] mt-1 line-clamp-1">
                  {activeVideo.author.name} · {activeVideo.caption}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
                {activeComments.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] py-8 text-center">
                    No comments yet. Write the first comment below.
                  </p>
                ) : (
                  activeComments.map((cmt) => (
                    <div
                      key={cmt.id}
                      className="pb-3 border-b border-white/5 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                          <span className="font-semibold text-white">{cmt.user}</span>
                          {cmt.createdAt && (
                            <>
                              <span>·</span>
                              <span>{cmt.createdAt}</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-[#F8FAFC] mt-1 leading-relaxed">{cmt.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="pt-3 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#131620] border border-white/10 text-xs text-white focus:outline-none focus:border-[#25F4EE]"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-[#FE2C55] text-white text-xs font-semibold hover:bg-[#e02449] transition-colors cursor-pointer shrink-0"
                  >
                    Post
                  </button>
                </div>
              </form>
            </>
          ) : null}
        </aside>
      </div>

      {/* Account Settings / Phone Number Recovery Drawer */}
      {isAccountDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[430px] bg-white text-[#161823] rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#161823]">
                  TikTok Account & Phone Recovery
                </h3>
                <p className="text-[11px] text-[#8A8B91]">
                  Cloud Server Saved — Mobile reset hone par bhi account wapas aa jayega
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountDrawerOpen(false)}
                className="text-xs font-bold text-[#8A8B91] hover:text-[#161823] cursor-pointer"
              >
                Close
              </button>
            </div>

            {profile && (
              <div className="p-3 rounded-xl bg-[#F1F1F2] flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  {profile.avatar && (
                    <img
                      src={profile.avatar}
                      alt={profile.name}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#161823] truncate">{profile.name}</p>
                    <p className="text-[11px] text-[#8A8B91] truncate">
                      {profile.handle} {profile.phone ? `· 📞 ${profile.phone}` : ''}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 text-[10px] font-bold">
                  Active
                </span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3 pt-1">
              <p className="text-xs font-bold text-[#161823]">
                Switch Account or Link Phone Number / TikTok @Username:
              </p>
              <input
                type="tel"
                value={authPhone}
                onChange={(e) => setAuthPhone(e.target.value)}
                placeholder="Phone Number (e.g. 03001234567)"
                className="w-full px-3 py-2.5 rounded-lg bg-[#F1F1F2] text-xs text-[#161823] placeholder-[#8A8B91] focus:outline-none"
              />
              <input
                type="text"
                value={editHandle}
                onChange={(e) => setEditHandle(e.target.value)}
                placeholder="TikTok @Username (e.g. @barkatalu23)"
                className="w-full px-3 py-2.5 rounded-lg bg-[#F1F1F2] text-xs text-[#161823] placeholder-[#8A8B91] focus:outline-none"
              />
              {authError && <p className="text-xs text-[#FE2C55] font-semibold">{authError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  onClick={() => setAuthMode('login')}
                  className="flex-1 py-2.5 rounded-lg bg-[#FE2C55] text-white text-xs font-bold cursor-pointer"
                >
                  {isAuthSubmitting ? 'Syncing...' : 'Sync / Switch Account'}
                </button>
                {profile && (
                  <button
                    type="button"
                    onClick={handleLogoutProfile}
                    className="px-4 py-2.5 rounded-lg bg-[#F1F1F2] text-[#161823] text-xs font-semibold cursor-pointer"
                  >
                    Log Out
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Comments Drawer */}
      {isMobileCommentsOpen && activeVideo && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
          <div className="w-full bg-[#131620] border-t border-white/10 rounded-t-3xl p-5 max-h-[75dvh] flex flex-col">
            <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-display text-sm font-bold text-white">
                {formatCompactCount(activeVideo.stats.comments)} Comments
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileCommentsOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-[#94A3B8] hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {activeComments.length === 0 ? (
                <p className="text-xs text-[#94A3B8] py-6 text-center">No comments yet.</p>
              ) : (
                activeComments.map((cmt) => (
                  <div key={cmt.id} className="pb-2.5 border-b border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
                      <span className="font-semibold text-white">{cmt.user}</span>
                      {cmt.createdAt && (
                        <>
                          <span>·</span>
                          <span>{cmt.createdAt}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-white mt-1">{cmt.text}</p>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleAddComment} className="pt-3 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add comment..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#090A0F] border border-white/10 text-xs text-white focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-[#FE2C55] text-white text-xs font-semibold cursor-pointer"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal (Strictly Linked to Logged-In User's Real Account) */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        authToken={authToken}
        accountName={profile?.name || ''}
        accountHandle={profile?.handle || ''}
        onRequireAuth={() => {
          stopAllMediaImmediately();
          setActiveScreen('my-profile');
        }}
        onUploaded={(newVideo) => {
          setVideos((prev) => [newVideo, ...prev]);
          setMyAccountVideos((prev) => [newVideo, ...prev]);
          setActiveIndex(0);
          setActiveScreen('feed');
          showToast(`Video uploaded to ${profile?.handle || 'your account'}!`);
        }}
      />

      {/* Share Drawer */}
      <ShareDrawer
        video={shareVideo}
        onClose={() => setShareVideo(null)}
        onDownloadNoWatermark={handleDownloadNoWatermark}
      />
    </div>
  );
}
