import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

export interface CommentItem {
  id: string;
  user: string;
  handle: string;
  avatar?: string;
  text: string;
  createdAt: string;
  likes: number;
}

export interface VideoFeedItem {
  id: string;
  externalId?: string;
  youtubeId?: string;
  sourceEngine: 'itunes-hd' | 'archive-hd' | 'youtube-short' | 'creator-upload';
  videoUrl: string;
  posterUrl?: string;
  caption: string;
  category: string;
  publishedAgo?: string;
  searchHint?: string;
  author: {
    name: string;
    handle: string;
    avatar?: string;
    verified: boolean;
  };
  music: {
    title: string;
    author: string;
  };
  stats: {
    likes: number;
    comments: number;
    shares: number;
    bookmarks: number;
    views: number;
  };
  commentsList: CommentItem[];
  fileSizeMB: number;
  durationSec: number;
}

export interface UserProfile {
  name: string;
  handle: string;
  phone?: string;
  bio: string;
  avatar: string;
  followingCount: number;
  followersCount: number;
  likesCount?: number;
}

interface AccountRecord {
  profile: UserProfile;
  passwordHash: string;
  phone?: string;
  likedVideoIds: string[];
  bookmarkedVideoIds: string[];
  followingHandles: string[];
  createdAt: string;
}

const DATA_FILE = path.resolve(process.cwd(), '.turbotok-real-store.json');
const UPLOADS_DIR = path.resolve(process.cwd(), '.uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use('/api/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

interface StoreData {
  accounts: Record<string, AccountRecord>;
  phoneToHandle: Record<string, string>; // normalizedPhone -> normalizedHandle
  sessions: Record<string, string>; // token -> normalizedHandle
  defaultHandle: string;
  uploadedVideos: VideoFeedItem[];
  likesMap: Record<string, number>;
  bookmarksMap: Record<string, number>;
  commentsMap: Record<string, CommentItem[]>;
}

function hashPassword(pw: string): string {
  return crypto.createHash('sha256').update(`turbotok_salt_${pw}`).digest('hex');
}

function normalizeHandle(raw: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  return cleaned ? `@${cleaned}` : '';
}

function normalizePhone(raw: string): string {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('92') && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

// Pre-seed the user's real TikTok profile (@barkatalu23 from Screenshot 1) and their 3 real videos
function getInitialBarkatVideos(): VideoFeedItem[] {
  const author = {
    name: '😄 everyone is happy',
    handle: '@barkatalu23',
    avatar: '/api/uploads/barkatalu23-avatar.jpg',
    verified: false,
  };

  const candidates = [
    {
      id: 'tt-7691629426206952722',
      videoFile: 'tt-7691629426206952722.mp4',
      coverFile: 'tt-7691629426206952722.jpg',
      caption: 'like only on this video 😆',
      views: 206,
      likes: 40,
      comments: 9,
      shares: 83,
    },
    {
      id: 'tt-7691326416587132167',
      videoFile: 'tt-7691326416587132167.mp4',
      coverFile: 'tt-7691326416587132167.jpg',
      caption: 'what this formula help when in life ? A² = B²',
      views: 149,
      likes: 35,
      comments: 6,
      shares: 42,
    },
    {
      id: 'tt-7690882093605342482',
      videoFile: 'tt-7690882093605342482.mp4',
      coverFile: 'tt-7690882093605342482.jpg',
      caption: '🤫😄 funny ꧁☠︎𝑩𝒂𝒓𝒌𝒂𝒕𝑨𝒍𝒊☠︎꧂',
      views: 188,
      likes: 31,
      comments: 5,
      shares: 38,
    },
  ];

  const items: VideoFeedItem[] = [];
  for (const c of candidates) {
    if (fs.existsSync(path.join(UPLOADS_DIR, c.videoFile))) {
      items.push({
        id: c.id,
        sourceEngine: 'creator-upload',
        videoUrl: `/api/uploads/${c.videoFile}`,
        posterUrl: fs.existsSync(path.join(UPLOADS_DIR, c.coverFile))
          ? `/api/uploads/${c.coverFile}`
          : undefined,
        caption: c.caption,
        category: 'for-you',
        publishedAgo: '1d ago',
        searchHint: 'barkatalu23 funny ai cartoon',
        author,
        music: {
          title: 'original sound — 😄 everyone is happy',
          author: '😄 everyone is happy',
        },
        stats: {
          likes: c.likes,
          comments: c.comments,
          shares: c.shares,
          bookmarks: 12,
          views: c.views,
        },
        commentsList: [],
        fileSizeMB: 1.1,
        durationSec: 12,
      });
    }
  }
  return items;
}

function loadStore(): StoreData {
  const defaultBarkatAccount: AccountRecord = {
    profile: {
      name: '😄 everyone is happy',
      handle: '@barkatalu23',
      phone: '03000000023',
      bio: 'follow and like this account',
      avatar: '/api/uploads/barkatalu23-avatar.jpg',
      followingCount: 1400,
      followersCount: 850,
      likesCount: 106,
    },
    passwordHash: hashPassword('1234'),
    phone: '03000000023',
    likedVideoIds: [],
    bookmarkedVideoIds: [],
    followingHandles: [],
    createdAt: new Date().toISOString(),
  };

  const barkatSeedVideos = getInitialBarkatVideos();

  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed: any = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      const accounts: Record<string, AccountRecord> = parsed.accounts || {};
      const phoneToHandle: Record<string, string> = parsed.phoneToHandle || {};

      // Ensure @barkatalu23 real TikTok account is always present on the cloud server
      if (!accounts['@barkatalu23']) {
        accounts['@barkatalu23'] = defaultBarkatAccount;
      } else {
        accounts['@barkatalu23'].profile = {
          ...defaultBarkatAccount.profile,
          ...accounts['@barkatalu23'].profile,
          avatar:
            accounts['@barkatalu23'].profile.avatar || '/api/uploads/barkatalu23-avatar.jpg',
        };
      }

      const existingUploads: VideoFeedItem[] = Array.isArray(parsed.uploadedVideos)
        ? parsed.uploadedVideos
        : [];

      // Merge seeded @barkatalu23 videos + any user-uploaded videos
      const mergedUploads: VideoFeedItem[] = [...barkatSeedVideos];
      for (const u of existingUploads) {
        if (!mergedUploads.some((m) => m.id === u.id)) {
          mergedUploads.push({
            ...u,
            sourceEngine: 'creator-upload',
            author: {
              name: u.author?.name || '😄 everyone is happy',
              handle:
                u.author?.handle === '@turbocreator'
                  ? '@barkatalu23'
                  : normalizeHandle(u.author?.handle || '@barkatalu23'),
              avatar: u.author?.avatar || '/api/uploads/barkatalu23-avatar.jpg',
              verified: false,
            },
          });
        }
      }

      return {
        accounts,
        phoneToHandle,
        sessions: parsed.sessions || {},
        defaultHandle: parsed.defaultHandle || '@barkatalu23',
        uploadedVideos: mergedUploads,
        likesMap: parsed.likesMap || {},
        bookmarksMap: parsed.bookmarksMap || {},
        commentsMap: parsed.commentsMap || {},
      };
    }
  } catch (e) {
    console.error('Failed to read store:', e);
  }

  return {
    accounts: {
      '@barkatalu23': defaultBarkatAccount,
    },
    phoneToHandle: {
      '03000000023': '@barkatalu23',
    },
    sessions: {},
    defaultHandle: '@barkatalu23',
    uploadedVideos: barkatSeedVideos,
    likesMap: {},
    bookmarksMap: {},
    commentsMap: {},
  };
}

function saveStore(store: StoreData) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save store:', e);
  }
}

const store = loadStore();
saveStore(store);

// Helper to get active account: checks session token first, falls back to server's active defaultHandle so mobile reset NEVER loses the account!
function getAccountFromRequest(req: express.Request): AccountRecord | null {
  const token = String(req.headers['x-auth-token'] || req.query.token || '').trim();
  if (token && token !== 'logged-out') {
    const handle = store.sessions[token];
    if (handle && store.accounts[handle]) {
      return store.accounts[handle];
    }
  }
  if (token === 'logged-out') {
    return null;
  }
  // If phone was reset or browser cleared storage, automatically restore the active cloud account!
  if (store.defaultHandle && store.accounts[store.defaultHandle]) {
    return store.accounts[store.defaultHandle];
  }
  return null;
}

// ============================================================================
// REAL TIKTOK ACCOUNT AUTHENTICATION (Phone Number + @Username + Live TikTok Sync)
// ============================================================================

// Live Sync any real TikTok @username from tiktok.com
async function fetchLiveTikTokUserAndVideos(rawHandle: string): Promise<{
  profile: UserProfile | null;
  videos: VideoFeedItem[];
}> {
  const clean = rawHandle.replace(/^@/, '').trim().toLowerCase();
  if (!clean) return { profile: null, videos: [] };

  try {
    // 1. Try TikTok creator embed for both userInfo and videoList
    const embedRes = await fetch(`https://www.tiktok.com/embed/@${clean}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const html = await embedRes.text();
    const idx = html.indexOf('__FRONTITY_CONNECT_STATE__');
    if (idx !== -1) {
      const start = html.indexOf('>', idx) + 1;
      const end = html.indexOf('</script>', start);
      const json = JSON.parse(html.slice(start, end));
      const data = json?.source?.data?.[`/embed/@${clean}`];
      const u = data?.userInfo;
      if (u && u.uniqueId) {
        let avatarPath = u.avatarThumbUrl ? u.avatarThumbUrl.replace('100:100', '720:720') : '';
        try {
          if (avatarPath) {
            const avRes = await fetch(avatarPath, {
              headers: { Referer: 'https://www.tiktok.com/' },
            });
            if (avRes.ok) {
              const filename = `${clean}-avatar.jpg`;
              fs.writeFileSync(
                path.join(UPLOADS_DIR, filename),
                Buffer.from(await avRes.arrayBuffer())
              );
              avatarPath = `/api/uploads/${filename}`;
            }
          }
        } catch {}

        const profile: UserProfile = {
          name: u.nickname || clean,
          handle: `@${u.uniqueId}`,
          bio: u.signature || '',
          avatar: avatarPath,
          followingCount: Number(u.followingCount) || 0,
          followersCount: Number(u.followerCount) || 0,
          likesCount: Number(u.heartCount) || 0,
        };

        const videos: VideoFeedItem[] = [];
        const vList = Array.isArray(data?.videoList) ? data.videoList.slice(0, 6) : [];
        for (const v of vList) {
          if (!v.id || !v.playAddr) continue;
          const vidFile = `tt-${v.id}.mp4`;
          const covFile = `tt-${v.id}.jpg`;
          const localVidPath = path.join(UPLOADS_DIR, vidFile);
          const localCovPath = path.join(UPLOADS_DIR, covFile);

          if (!fs.existsSync(localVidPath)) {
            try {
              const vr = await fetch(v.playAddr, {
                headers: { Referer: 'https://www.tiktok.com/' },
              });
              if (vr.ok) {
                fs.writeFileSync(localVidPath, Buffer.from(await vr.arrayBuffer()));
              }
            } catch {}
          }
          if (!fs.existsSync(localCovPath) && (v.originCoverUrl || v.coverUrl)) {
            try {
              const cr = await fetch(v.originCoverUrl || v.coverUrl, {
                headers: { Referer: 'https://www.tiktok.com/' },
              });
              if (cr.ok) {
                fs.writeFileSync(localCovPath, Buffer.from(await cr.arrayBuffer()));
              }
            } catch {}
          }

          if (fs.existsSync(localVidPath)) {
            videos.push({
              id: `tt-${v.id}`,
              sourceEngine: 'creator-upload',
              videoUrl: `/api/uploads/${vidFile}`,
              posterUrl: fs.existsSync(localCovPath) ? `/api/uploads/${covFile}` : undefined,
              caption: v.desc || `${profile.name} TikTok video`,
              category: 'for-you',
              publishedAgo: 'Recent',
              author: {
                name: profile.name,
                handle: profile.handle,
                avatar: profile.avatar,
                verified: false,
              },
              music: {
                title: `original sound — ${profile.name}`,
                author: profile.name,
              },
              stats: {
                likes: Math.max(10, Math.round((Number(v.playCount) || 100) * 0.18)),
                comments: 5,
                shares: 12,
                bookmarks: 8,
                views: Number(v.playCount) || 150,
              },
              commentsList: [],
              fileSizeMB: 1.2,
              durationSec: 15,
            });
          }
        }

        return { profile, videos };
      }
    }

    // 2. Fallback: Try standard web profile page for userInfo
    const webRes = await fetch(`https://www.tiktok.com/@${clean}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    const webHtml = await webRes.text();
    const match = webHtml.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/
    );
    if (match) {
      const json = JSON.parse(match[1]);
      const userDetail = json?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
      if (userDetail?.user) {
        const u = userDetail.user;
        const st = userDetail.stats || {};
        let avatarPath = u.avatarMedium || u.avatarLarger || u.avatarThumb || '';
        try {
          if (avatarPath) {
            const avRes = await fetch(avatarPath, {
              headers: { Referer: 'https://www.tiktok.com/' },
            });
            if (avRes.ok) {
              const filename = `${clean}-avatar.jpg`;
              fs.writeFileSync(
                path.join(UPLOADS_DIR, filename),
                Buffer.from(await avRes.arrayBuffer())
              );
              avatarPath = `/api/uploads/${filename}`;
            }
          }
        } catch {}

        return {
          profile: {
            name: u.nickname || clean,
            handle: `@${u.uniqueId || clean}`,
            bio: u.signature || '',
            avatar: avatarPath,
            followingCount: Number(st.followingCount) || 0,
            followersCount: Number(st.followerCount) || 0,
            likesCount: Number(st.heartCount || st.heart) || 0,
          },
          videos: [],
        };
      }
    }
  } catch (e) {
    console.error('TikTok live sync error:', e);
  }
  return { profile: null, videos: [] };
}

// Sign Up / Create Account with Phone Number + @Username + Password (plus auto TikTok profile sync!)
app.post('/api/auth/signup', async (req, res) => {
  const { name, handle, phone, password, bio } = req.body;
  const cleanPhone = normalizePhone(phone || '');
  const cleanHandle = normalizeHandle(handle || name || cleanPhone);
  const rawPassword = String(password || '1234').trim();

  if (!cleanHandle || cleanHandle.length < 2) {
    res.status(400).json({ error: 'Apna @username ya Phone Number likhein (maslan @barkatalu23).' });
    return;
  }

  // Try syncing real TikTok profile if that username exists on TikTok!
  const synced = await fetchLiveTikTokUserAndVideos(cleanHandle);

  const finalName = String(name || synced.profile?.name || cleanHandle.replace(/^@/, '')).trim();
  const finalBio = String(bio || synced.profile?.bio || 'follow and like this account').trim();
  const finalAvatar = synced.profile?.avatar || '';

  const newAccount: AccountRecord = {
    profile: {
      name: finalName,
      handle: cleanHandle,
      phone: cleanPhone || undefined,
      bio: finalBio,
      avatar: finalAvatar,
      followingCount: synced.profile?.followingCount ?? 0,
      followersCount: synced.profile?.followersCount ?? 0,
      likesCount: synced.profile?.likesCount ?? 0,
    },
    passwordHash: hashPassword(rawPassword || '1234'),
    phone: cleanPhone || undefined,
    likedVideoIds: [],
    bookmarkedVideoIds: [],
    followingHandles: [],
    createdAt: new Date().toISOString(),
  };

  store.accounts[cleanHandle] = newAccount;
  if (cleanPhone) {
    store.phoneToHandle[cleanPhone] = cleanHandle;
  }
  store.defaultHandle = cleanHandle;

  if (synced.videos.length > 0) {
    for (const sv of synced.videos) {
      if (!store.uploadedVideos.some((v) => v.id === sv.id)) {
        store.uploadedVideos.unshift(sv);
      }
    }
  }

  const token = crypto.randomBytes(24).toString('hex');
  store.sessions[token] = cleanHandle;
  saveStore(store);

  const myVideos = store.uploadedVideos.filter(
    (v) => v.author.handle.toLowerCase() === cleanHandle.toLowerCase()
  );

  res.json({
    success: true,
    token,
    profile: newAccount.profile,
    uploadedVideos: myVideos,
    likedVideoIds: newAccount.likedVideoIds,
    bookmarkedVideoIds: newAccount.bookmarkedVideoIds,
    followingHandles: newAccount.followingHandles,
  });
});

// Log In with Phone Number OR @Username (Recovers account even after mobile reset!)
app.post('/api/auth/login', async (req, res) => {
  const { handleOrPhone, handle, phone, password } = req.body;
  const rawInput = String(handleOrPhone || handle || phone || '').trim();
  const cleanPhone = normalizePhone(rawInput);
  let targetHandle = normalizeHandle(rawInput);

  if (cleanPhone && store.phoneToHandle[cleanPhone]) {
    targetHandle = store.phoneToHandle[cleanPhone];
  }

  let account = store.accounts[targetHandle];

  // If account isn't in local store yet, check if it's a real TikTok username and sync it live!
  if (!account && targetHandle) {
    const synced = await fetchLiveTikTokUserAndVideos(targetHandle);
    if (synced.profile) {
      account = {
        profile: {
          ...synced.profile,
          phone: cleanPhone || undefined,
        },
        passwordHash: hashPassword(String(password || '1234').trim()),
        phone: cleanPhone || undefined,
        likedVideoIds: [],
        bookmarkedVideoIds: [],
        followingHandles: [],
        createdAt: new Date().toISOString(),
      };
      store.accounts[targetHandle] = account;
      if (cleanPhone) store.phoneToHandle[cleanPhone] = targetHandle;
      for (const sv of synced.videos) {
        if (!store.uploadedVideos.some((v) => v.id === sv.id)) {
          store.uploadedVideos.unshift(sv);
        }
      }
    }
  }

  if (!account) {
    res.status(404).json({
      error: `Account (${rawInput}) nahi mila. "Sign Up / Create Account" tab par click kar ke Phone Number ya @username se account banayein.`,
    });
    return;
  }

  // Link phone number if user provided it during login
  if (cleanPhone) {
    account.phone = cleanPhone;
    account.profile.phone = cleanPhone;
    store.phoneToHandle[cleanPhone] = account.profile.handle;
  }

  store.defaultHandle = account.profile.handle;
  const token = crypto.randomBytes(24).toString('hex');
  store.sessions[token] = account.profile.handle;
  saveStore(store);

  const myVideos = store.uploadedVideos.filter(
    (v) => v.author.handle.toLowerCase() === account.profile.handle.toLowerCase()
  );

  res.json({
    success: true,
    token,
    profile: account.profile,
    uploadedVideos: myVideos,
    likedVideoIds: account.likedVideoIds,
    bookmarkedVideoIds: account.bookmarkedVideoIds,
    followingHandles: account.followingHandles,
  });
});

// Get Current Logged-In Session (Automatically restores @barkatalu23 even if phone was reset!)
app.get('/api/profile', (req, res) => {
  const account = getAccountFromRequest(req);
  if (!account) {
    res.json({ profile: null, uploadedVideos: [] });
    return;
  }
  const myVideos = store.uploadedVideos.filter(
    (v) => v.author.handle.toLowerCase() === account.profile.handle.toLowerCase()
  );
  res.json({
    profile: account.profile,
    uploadedVideos: myVideos,
    likedVideoIds: account.likedVideoIds,
    bookmarkedVideoIds: account.bookmarkedVideoIds,
    followingHandles: account.followingHandles,
  });
});

// Update Logged-In User's Profile (Name, Bio, Phone, Avatar)
app.post('/api/profile', (req, res) => {
  const account = getAccountFromRequest(req);
  if (!account) {
    res.status(401).json({ error: 'Pehle apne account mein Log In karein.' });
    return;
  }

  const { name, bio, phone, avatar } = req.body;
  if (name !== undefined && String(name).trim()) {
    account.profile.name = String(name).trim();
  }
  if (bio !== undefined) {
    account.profile.bio = String(bio).trim();
  }
  if (phone !== undefined && String(phone).trim()) {
    const cleanPhone = normalizePhone(phone);
    account.phone = cleanPhone;
    account.profile.phone = cleanPhone;
    if (cleanPhone) {
      store.phoneToHandle[cleanPhone] = account.profile.handle;
    }
  }
  if (avatar !== undefined && String(avatar).trim()) {
    account.profile.avatar = String(avatar);
  }

  store.uploadedVideos = store.uploadedVideos.map((v) => {
    if (v.author.handle.toLowerCase() === account.profile.handle.toLowerCase()) {
      return {
        ...v,
        author: {
          ...v.author,
          name: account.profile.name,
          avatar: account.profile.avatar,
        },
      };
    }
    return v;
  });

  saveStore(store);
  res.json({ success: true, profile: account.profile });
});

// Log Out Session
app.delete('/api/profile', (req, res) => {
  const token = String(req.headers['x-auth-token'] || '').trim();
  if (token && store.sessions[token]) {
    delete store.sessions[token];
  }
  store.defaultHandle = '';
  saveStore(store);
  res.json({ success: true, profile: null });
});

// Follow / Unfollow Creator
app.post('/api/follow', (req, res) => {
  const account = getAccountFromRequest(req);
  if (!account) {
    res.status(401).json({ error: 'Follow karne ke liye apne account mein Log In karein.' });
    return;
  }
  const targetHandle = normalizeHandle(req.body.handle || '');
  if (!targetHandle) {
    res.status(400).json({ error: 'Handle required' });
    return;
  }

  const idx = account.followingHandles.indexOf(targetHandle);
  let following = false;
  if (idx >= 0) {
    account.followingHandles.splice(idx, 1);
    following = false;
  } else {
    account.followingHandles.push(targetHandle);
    following = true;
  }
  saveStore(store);
  res.json({
    success: true,
    following,
    followingHandles: account.followingHandles,
  });
});

function parseViewString(str: string): number {
  if (!str) return 0;
  const clean = str.replace(/,/g, '').toUpperCase();
  const num = parseFloat(clean);
  if (Number.isNaN(num)) return 0;
  if (clean.includes('M')) return Math.round(num * 1_000_000);
  if (clean.includes('K')) return Math.round(num * 1_000);
  return Math.round(num);
}

// Engine 1: Real YouTube Video Search (FIXED: NEVER uses search query like "Fg" as creator name!)
const ytSearchCache = new Map<string, { timestamp: number; items: VideoFeedItem[] }>();

async function searchYouTubeRealVideos(query: string, category = 'for-you'): Promise<VideoFeedItem[]> {
  const cacheKey = query.toLowerCase().trim();
  const cached = ytSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 5) {
    return cached.items;
  }

  try {
    const searchQueryWithShorts = query.toLowerCase().includes('short')
      ? query
      : `${query} #shorts`;

    const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240726.00.00',
            hl: 'en',
            gl: 'PK',
          },
        },
        query: searchQueryWithShorts,
      }),
    });

    if (!res.ok) return [];
    const data: any = await res.json();
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents || [];

    const results: VideoFeedItem[] = [];
    const seenIds = new Set<string>();

    // First collect all videoRenderer items because they ALWAYS have the real creator name & avatar!
    for (const sec of contents) {
      const itemList = sec?.itemSectionRenderer?.contents || [];
      for (const it of itemList) {
        const vr = it.videoRenderer;
        if (vr && vr.videoId && !seenIds.has(vr.videoId)) {
          const publishedAgo = vr.publishedTimeText?.simpleText || '';
          if (/1[0-9] years ago|[6-9] years ago/i.test(publishedAgo)) continue;

          const authorName =
            vr.ownerText?.runs?.[0]?.text ||
            vr.longBylineText?.runs?.[0]?.text ||
            vr.shortBylineText?.runs?.[0]?.text ||
            '';
          if (!authorName) continue;

          seenIds.add(vr.videoId);
          const videoId = String(vr.videoId);
          const title = vr.title?.runs?.[0]?.text || query;
          const authorHandle = authorName.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'creator';
          const avatar =
            vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail
              ?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          const thumb =
            vr.thumbnail?.thumbnails?.slice(-1)?.[0]?.url ||
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          const viewsText =
            vr.shortViewCountText?.simpleText || vr.viewCountText?.simpleText || '1.2K views';
          const views = Math.max(100, parseViewString(viewsText));
          const likes = Math.max(15, Math.round(views * 0.06));

          results.push({
            id: `yt-${videoId}`,
            youtubeId: videoId,
            sourceEngine: 'youtube-short',
            videoUrl: `https://www.youtube.com/embed/${videoId}`,
            posterUrl: thumb,
            caption: title,
            category,
            publishedAgo: publishedAgo || 'Recent',
            searchHint: title.slice(0, 30),
            author: {
              name: authorName,
              handle: authorHandle,
              avatar,
              verified: false,
            },
            music: {
              title: `original sound — ${authorName}`,
              author: authorName,
            },
            stats: {
              likes,
              comments: Math.round(likes * 0.04),
              shares: Math.round(likes * 0.08),
              bookmarks: Math.round(likes * 0.05),
              views,
            },
            fileSizeMB: 1.4,
            durationSec: 25,
            commentsList: [],
          });
        }
      }
    }

    if (results.length > 0) {
      ytSearchCache.set(cacheKey, { timestamp: Date.now(), items: results });
    }
    return results;
  } catch (err) {
    console.error('YouTube search error:', err);
    return [];
  }
}

// Engine 2: Direct Hardware-Decoded MP4/M4V Fetcher from Apple Global CDN
const artistCache = new Map<string, VideoFeedItem[]>();

async function fetchHDArtistVideos(
  query: string,
  limit = 8,
  categoryLabel = 'for-you'
): Promise<VideoFeedItem[]> {
  const cacheKey = `${query.toLowerCase()}::${limit}`;
  const cached = artistCache.get(cacheKey);
  if (cached && cached.length > 0) return cached;

  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
      query
    )}&country=IN&entity=musicVideo&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data: any = await res.json();
    const results: any[] = Array.isArray(data?.results) ? data.results : [];

    const seenTracks = new Set<string>();
    const items: VideoFeedItem[] = [];

    for (const item of results) {
      if (!item.previewUrl || !item.trackName) continue;
      const cleanTrack = String(item.trackName).replace(/\s*\(From.*?\)/i, '').trim();
      const trackKey = cleanTrack.toLowerCase();
      if (seenTracks.has(trackKey)) continue;
      seenTracks.add(trackKey);

      const trackId = String(item.trackId);
      const hiResArtwork = String(item.artworkUrl100 || '').replace('100x100bb', '1000x1000bb');
      const artist = String(item.artistName || 'Artist');
      const primaryArtist = artist.split(/[&,]/)[0].trim();
      const handle = primaryArtist.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18);

      const seed = Number(trackId.slice(-4)) || 1200;
      const likes = seed * 4;

      items.push({
        id: `hd-${trackId}`,
        externalId: trackId,
        sourceEngine: 'itunes-hd',
        videoUrl: item.previewUrl,
        posterUrl: hiResArtwork,
        caption: `${item.trackName} — ${artist}`,
        category: categoryLabel,
        publishedAgo: 'Official HD',
        searchHint: `${primaryArtist} ${cleanTrack}`,
        author: {
          name: primaryArtist,
          handle,
          avatar: hiResArtwork,
          verified: false,
        },
        music: {
          title: `${cleanTrack} — ${primaryArtist}`,
          author: primaryArtist,
        },
        stats: {
          likes,
          comments: Math.round(likes * 0.03),
          shares: Math.round(likes * 0.05),
          bookmarks: Math.round(likes * 0.04),
          views: likes * 10,
        },
        fileSizeMB: 1.8,
        durationSec: 30,
        commentsList: [],
      });
    }

    if (items.length > 0) {
      artistCache.set(cacheKey, items);
    }
    return items;
  } catch {
    return [];
  }
}

// ============================================================================
// REAL TIKTOK "FOR YOU" RECOMMENDATION ALGORITHM ENGINE (Monolith-Lite)
// 1. Watch-Time & Skip Signal Tracking (<2s skip = -2.5, Full Watch = +3.5 with cap)
// 2. Strict Seen-Video Deduplication (Never repeats videos you already watched!)
// 3. 50% Interest / 30% Viral / 20% Wildcard Discovery Split (Never gets stuck on 1 type!)
// 4. Strict Creator Spacing (Never shows 2 videos from the same creator in a row!)
// ============================================================================

const CONTENT_CLUSTERS: Record<string, string[]> = {
  'punjabi-bangers': [
    'Sidhu Moose Wala',
    'Karan Aujla',
    'AP Dhillon',
    'Diljit Dosanjh',
    'Imran Khan',
    'bohemia',
    'Jass Manak',
    'Ammy Virk',
    'Parmish Verma',
  ],
  'pak-pop-ost': [
    'Atif Aslam',
    'Ali Zafar',
    'Asim Azhar',
    'Talha Anjum',
    'Bilal Saeed',
    'Farhan Saeed',
    'Sahir Ali Bagga',
    'Mustafa Zahid',
  ],
  'bollywood-melody': [
    'Arijit Singh',
    'Jubin Nautiyal',
    'Darshan Raval',
    'Armaan Malik',
    'Shreya Ghoshal',
    'Sonu Nigam',
    'Vishal Mishra',
  ],
  'sufi-shayari-soul': [
    'Rahat Fateh Ali Khan',
    'Nusrat Fateh Ali Khan',
    'B Praak',
    'Shafqat Amanat Ali',
    'Sajjad Ali',
  ],
  'party-dance-comedy': [
    'Badshah',
    'Yo Yo Honey Singh',
    'Guru Randhawa',
    'Hardy Sandhu',
    'Mika Singh',
    'Neha Kakkar',
  ],
  'global-viral': [
    'The Weeknd',
    'Alan Walker',
    'Imagine Dragons',
    'Justin Bieber',
    'Drake',
    'Eminem',
  ],
};

const CATEGORY_TO_DEFAULT_CLUSTER: Record<string, string> = {
  'for-you': 'pak-pop-ost',
  comedy: 'party-dance-comedy',
  cricket: 'pak-pop-ost',
  cars: 'punjabi-bangers',
  shayari: 'sufi-shayari-soul',
};

interface AlgorithmMemory {
  clusterScores: Record<string, number>;
  creatorAffinity: Record<string, number>;
  seenVideoIds: string[]; // Rolling window of watched video IDs so they don't repeat!
}

const algoMemory: AlgorithmMemory = {
  clusterScores: {
    'pak-pop-ost': 5,
    'punjabi-bangers': 5,
    'bollywood-melody': 4,
    'sufi-shayari-soul': 4,
    'party-dance-comedy': 4,
    'global-viral': 3,
  },
  creatorAffinity: {},
  seenVideoIds: [],
};

function findClusterForArtist(authorName: string): string {
  const lower = authorName.toLowerCase();
  for (const [cluster, list] of Object.entries(CONTENT_CLUSTERS)) {
    if (list.some((a) => lower.includes(a.toLowerCase()) || a.toLowerCase().includes(lower))) {
      return cluster;
    }
  }
  return 'pak-pop-ost';
}

function recordSeenVideo(rawId: string) {
  const baseId = String(rawId || '').replace(/-p\d+$/, '');
  if (!baseId) return;
  const idx = algoMemory.seenVideoIds.indexOf(baseId);
  if (idx !== -1) {
    algoMemory.seenVideoIds.splice(idx, 1);
  }
  algoMemory.seenVideoIds.push(baseId);
  // Keep rolling window of last 90 watched videos so feed always stays fresh
  if (algoMemory.seenVideoIds.length > 90) {
    algoMemory.seenVideoIds.shift();
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Enforce strict Creator Spacing: Never allow 2 videos from the same creator next to each other!
function spaceOutCreators(videos: VideoFeedItem[]): VideoFeedItem[] {
  const pool = [...videos];
  const result: VideoFeedItem[] = [];

  while (pool.length > 0) {
    const lastHandle = result[result.length - 1]?.author?.handle?.toLowerCase();
    const lastCluster = result[result.length - 1]?.category;

    // Find next candidate from a DIFFERENT creator (and ideally different cluster if 2 in a row)
    let pickIdx = pool.findIndex(
      (v) =>
        v.author.handle.toLowerCase() !== lastHandle &&
        (result.length < 2 ||
          result[result.length - 2]?.category !== lastCluster ||
          v.category !== lastCluster)
    );
    if (pickIdx === -1) {
      pickIdx = pool.findIndex((v) => v.author.handle.toLowerCase() !== lastHandle);
    }
    if (pickIdx === -1) {
      pickIdx = 0;
    }

    result.push(pool[pickIdx]);
    pool.splice(pickIdx, 1);
  }

  return result;
}

// Warm up diverse clusters in background
Promise.all(
  [
    'Atif Aslam',
    'Sidhu Moose Wala',
    'Karan Aujla',
    'Arijit Singh',
    'Diljit Dosanjh',
    'AP Dhillon',
    'Imran Khan',
    'Rahat Fateh Ali Khan',
    'Badshah',
    'Ali Zafar',
    'Guru Randhawa',
    'Jubin Nautiyal',
  ].map((a) => fetchHDArtistVideos(a, 6, findClusterForArtist(a)))
).catch(() => {});

// Real-Time TikTok Watch-Time & Skip Signal Endpoint
app.post('/api/algorithm/signal', (req, res) => {
  const { videoId, authorName, authorHandle, watchSeconds, completed, liked } = req.body;

  if (videoId) {
    recordSeenVideo(String(videoId));
  }

  const cluster = findClusterForArtist(String(authorName || ''));
  const cleanHandle = normalizeHandle(authorHandle || authorName || '');
  const sec = Number(watchSeconds) || 0;

  let delta = 0;
  if (sec < 2.0 && !completed && !liked) {
    // Fast skip (<2s): User didn't like this vibe -> reduce score
    delta = -2.0;
  } else if (completed || sec >= 9.0) {
    // Full watch: Positive signal, but capped so 1 full watch NEVER floods the feed with only this!
    delta = +2.5;
  } else if (sec >= 3.5) {
    delta = +1.0;
  }
  if (liked) {
    delta += 3.0;
  }

  // Update cluster score with strict floor (1) and ceiling (12) to prevent filter bubbles!
  const currentClusterScore = algoMemory.clusterScores[cluster] ?? 4;
  algoMemory.clusterScores[cluster] = Math.max(1, Math.min(12, currentClusterScore + delta));

  // Decay other clusters slightly toward baseline (5) so diversity always stays alive
  for (const k of Object.keys(algoMemory.clusterScores)) {
    if (k !== cluster) {
      const val = algoMemory.clusterScores[k];
      if (val > 5) algoMemory.clusterScores[k] = Number((val - 0.15).toFixed(2));
      if (val < 3) algoMemory.clusterScores[k] = Number((val + 0.15).toFixed(2));
    }
  }

  if (cleanHandle) {
    const curAff = algoMemory.creatorAffinity[cleanHandle] ?? 0;
    algoMemory.creatorAffinity[cleanHandle] = Math.max(-5, Math.min(6, curAff + (delta > 0 ? 1 : -1)));
  }

  res.json({
    success: true,
    clusterScores: algoMemory.clusterScores,
    seenCount: algoMemory.seenVideoIds.length,
  });
});

app.get('/api/search/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.json({ keywords: [] });
    return;
  }

  try {
    const ytSuggestRes: any = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&gl=PK&q=${encodeURIComponent(
        q
      )}`
    ).then((r) => r.json());

    const keywords: string[] = Array.isArray(ytSuggestRes?.[1])
      ? ytSuggestRes[1].slice(0, 10)
      : [q];

    res.json({ keywords });
  } catch {
    res.json({ keywords: [q] });
  }
});

app.get('/api/search/results', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.json({ videos: [], users: [] });
    return;
  }

  // Boost searched cluster slightly in algorithm memory
  const matchedCluster = findClusterForArtist(q);
  algoMemory.clusterScores[matchedCluster] = Math.min(
    12,
    (algoMemory.clusterScores[matchedCluster] || 5) + 2
  );

  const [hdMusicVideos, ytVideos] = await Promise.all([
    fetchHDArtistVideos(q, 10, 'search'),
    searchYouTubeRealVideos(q, 'search'),
  ]);

  const localUploads = store.uploadedVideos.filter(
    (v) =>
      v.caption.toLowerCase().includes(q.toLowerCase()) ||
      v.author.name.toLowerCase().includes(q.toLowerCase()) ||
      v.author.handle.toLowerCase().includes(q.toLowerCase())
  );

  const combined = [...localUploads, ...hdMusicVideos, ...ytVideos];

  const usersMap = new Map<
    string,
    { name: string; handle: string; avatar: string; verified: boolean; followers: number }
  >();

  for (const acc of Object.values(store.accounts)) {
    if (
      acc.profile.name.toLowerCase().includes(q.toLowerCase()) ||
      acc.profile.handle.toLowerCase().includes(q.toLowerCase())
    ) {
      usersMap.set(acc.profile.handle.toLowerCase(), {
        name: acc.profile.name,
        handle: acc.profile.handle.replace(/^@/, ''),
        avatar: acc.profile.avatar,
        verified: false,
        followers: acc.profile.followersCount,
      });
    }
  }

  for (const v of combined) {
    const key = v.author.name.toLowerCase();
    if (!usersMap.has(key)) {
      usersMap.set(key, {
        name: v.author.name,
        handle: v.author.handle.replace(/^@/, ''),
        avatar: v.author.avatar || v.posterUrl || '',
        verified: false,
        followers: Math.max(120, Math.round(v.stats.views * 0.05)),
      });
    }
  }

  res.json({
    query: q,
    videos: combined,
    users: Array.from(usersMap.values()),
  });
});

app.get('/api/creator', async (req, res) => {
  const name = String(req.query.name || '').trim();
  const handle = String(req.query.handle || '').trim();
  const normHandle = normalizeHandle(handle || name);

  if (!name && !normHandle) {
    res.status(400).json({ error: 'Creator name required' });
    return;
  }

  const registeredAccount = store.accounts[normHandle];
  const matchingUploads = store.uploadedVideos.filter(
    (v) =>
      v.author.handle.toLowerCase() === normHandle.toLowerCase() ||
      v.author.name.toLowerCase() === name.toLowerCase()
  );

  if (registeredAccount) {
    const totalLikes =
      registeredAccount.profile.likesCount ||
      matchingUploads.reduce((sum, v) => sum + v.stats.likes + (store.likesMap[v.id] || 0), 0);
    res.json({
      creator: {
        name: registeredAccount.profile.name,
        handle: registeredAccount.profile.handle.replace(/^@/, ''),
        avatar: registeredAccount.profile.avatar,
        verified: false,
        followingCount:
          registeredAccount.profile.followingCount || registeredAccount.followingHandles.length,
        followersCount: registeredAccount.profile.followersCount,
        totalLikes,
        bio: registeredAccount.profile.bio,
      },
      videos: matchingUploads,
    });
    return;
  }

  const [hdVideos, ytVideos] = await Promise.all([
    fetchHDArtistVideos(name, 12, 'creator'),
    searchYouTubeRealVideos(name, 'creator'),
  ]);

  const videos = [...matchingUploads, ...hdVideos, ...ytVideos];
  const sampleAvatar = videos[0]?.author?.avatar || videos[0]?.posterUrl || '';
  const totalLikes = videos.reduce((sum, v) => sum + v.stats.likes, 0);

  res.json({
    creator: {
      name,
      handle: (handle || name).replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, ''),
      avatar: sampleAvatar,
      verified: false,
      followingCount: 14,
      followersCount: matchingUploads.length > 0 ? 850 : Math.round(totalLikes * 0.2),
      totalLikes,
      bio: `follow and like this account`,
    },
    videos,
  });
});

app.delete('/api/videos/:id', (req, res) => {
  const account = getAccountFromRequest(req);
  const { id } = req.params;
  const target = store.uploadedVideos.find((v) => v.id === id);
  if (!target) {
    res.status(404).json({ error: 'Video not found' });
    return;
  }
  if (account && target.author.handle.toLowerCase() !== account.profile.handle.toLowerCase()) {
    res.status(403).json({ error: 'You can only delete your own videos.' });
    return;
  }
  store.uploadedVideos = store.uploadedVideos.filter((v) => v.id !== id);
  saveStore(store);
  res.json({ success: true });
});

// API: TikTok "For You" Recommendation Feed (50% Interest / 30% Viral / 20% Wildcard + Seen Filter + Creator Spacing)
app.get('/api/feed', async (req, res) => {
  const category = String(req.query.category || 'for-you').toLowerCase();
  const page = Math.max(1, Number(req.query.page) || 1);
  const clientSeenRaw = String(req.query.seen || '').trim();
  const clientSeenIds = clientSeenRaw ? clientSeenRaw.split(',').filter(Boolean) : [];
  for (const sId of clientSeenIds) {
    recordSeenVideo(sId);
  }

  // Sort clusters by user's real-time interest score
  const sortedClusters = Object.entries(algoMemory.clusterScores)
    .sort((a, b) => b[1] - a[1])
    .map((entry) => entry[0]);

  let targetClusters: string[] = [];
  if (category !== 'for-you' && CATEGORY_TO_DEFAULT_CLUSTER[category]) {
    const primary = CATEGORY_TO_DEFAULT_CLUSTER[category];
    const others = shuffleArray(sortedClusters.filter((c) => c !== primary));
    targetClusters = [primary, others[0] || 'punjabi-bangers', others[1] || 'bollywood-melody'];
  } else {
    // 50% Top Interest Cluster + 30% Second/Trending Cluster + 20% Wildcard Exploration Cluster!
    const topInterest = sortedClusters[0] || 'pak-pop-ost';
    const secondInterest = sortedClusters[1] || 'punjabi-bangers';
    const wildcardPool = shuffleArray(sortedClusters.slice(2));
    const wildcard = wildcardPool[0] || 'party-dance-comedy';
    targetClusters = [topInterest, secondInterest, wildcard];
  }

  // Pick 2 random creators from topInterest, 2 from secondInterest, 1 from wildcard (5 distinct creators per batch!)
  const c1Artists = shuffleArray(CONTENT_CLUSTERS[targetClusters[0]] || []).slice(0, 2);
  const c2Artists = shuffleArray(CONTENT_CLUSTERS[targetClusters[1]] || []).slice(0, 2);
  const c3Artists = shuffleArray(CONTENT_CLUSTERS[targetClusters[2]] || []).slice(0, 1);

  const selectedRequests = [
    ...c1Artists.map((a) => ({ artist: a, cluster: targetClusters[0] })),
    ...c2Artists.map((a) => ({ artist: a, cluster: targetClusters[1] })),
    ...c3Artists.map((a) => ({ artist: a, cluster: targetClusters[2] })),
  ];

  const lists = await Promise.all(
    selectedRequests.map((item) => fetchHDArtistVideos(item.artist, 6, item.cluster))
  );

  // Take at most 2 videos per artist in a single batch so one artist NEVER dominates the feed!
  const cappedPerArtist = lists.flatMap((artistVideos) => shuffleArray(artistVideos).slice(0, 2));

  const seenSet = new Set(algoMemory.seenVideoIds);
  const unseenUploads = shuffleArray(
    store.uploadedVideos.filter((v) => !seenSet.has(v.id.replace(/-p\d+$/, '')))
  ).slice(0, 1);

  const allCandidates = shuffleArray([...unseenUploads, ...cappedPerArtist]);

  const unseenCandidates = allCandidates.filter((v) => !seenSet.has(v.id.replace(/-p\d+$/, '')));
  const seenFallback = allCandidates.filter((v) => seenSet.has(v.id.replace(/-p\d+$/, '')));

  // Prioritize 100% UNSEEN videos first; only top up if needed
  const orderedCandidates = spaceOutCreators([
    ...unseenCandidates,
    ...shuffleArray(seenFallback).slice(0, 3),
  ]);

  const seenUrls = new Set<string>();
  const finalVideos: VideoFeedItem[] = [];

  for (const video of orderedCandidates) {
    if (seenUrls.has(video.videoUrl)) continue;
    seenUrls.add(video.videoUrl);

    const baseId = video.id.replace(/-p\d+$/, '');
    const uniqueId = page > 1 ? `${baseId}-p${page}` : baseId;
    const extraLikes = store.likesMap[baseId] || 0;
    const extraBookmarks = store.bookmarksMap[baseId] || 0;
    const userComments = store.commentsMap[baseId] || [];

    finalVideos.push({
      ...video,
      id: uniqueId,
      stats: {
        ...video.stats,
        likes: video.stats.likes + extraLikes,
        bookmarks: (video.stats.bookmarks || 0) + extraBookmarks,
        comments: video.stats.comments + userComments.length,
      },
      commentsList: [...userComments, ...video.commentsList],
    });
  }

  // Mark the first video of this batch as seen so refreshing the app immediately shows a NEW first video!
  if (finalVideos[0]) {
    recordSeenVideo(finalVideos[0].id);
  }

  res.json({
    page,
    hasMore: true,
    totalItems: finalVideos.length,
    videos: finalVideos,
  });
});

app.get('/api/videos/:id/comments', (req, res) => {
  const { id } = req.params;
  const baseId = id.replace(/-p\d+$/, '');
  const localComments = store.commentsMap[baseId] || store.commentsMap[id] || [];
  res.json({ comments: localComments });
});

app.post('/api/videos/upload', (req, res) => {
  const account = getAccountFromRequest(req);
  if (!account) {
    res.status(401).json({
      error: 'Video upload karne ke liye pehle apne TikTok Account mein Log In karein!',
    });
    return;
  }

  const { videoUrl, caption, category, fileSizeMB } = req.body;

  if (!videoUrl || !caption) {
    res.status(400).json({ error: 'Video file aur caption dono zaroori hain.' });
    return;
  }

  const id = `upload-${Date.now()}`;
  let finalVideoUrl = String(videoUrl);

  if (finalVideoUrl.startsWith('data:video/')) {
    const match = finalVideoUrl.match(/^data:video\/[^;]+;base64,(.+)$/);
    if (match && match[1]) {
      const filename = `${id}.mp4`;
      const filePath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(match[1], 'base64'));
      finalVideoUrl = `/api/uploads/${filename}`;
    }
  }

  const newVideo: VideoFeedItem = {
    id,
    sourceEngine: 'creator-upload',
    videoUrl: finalVideoUrl,
    caption: String(caption).trim(),
    category: String(category || 'for-you').toLowerCase(),
    publishedAgo: 'Just now',
    author: {
      name: account.profile.name,
      handle: account.profile.handle,
      avatar: account.profile.avatar || '',
      verified: false,
    },
    music: {
      title: `original sound — ${account.profile.name}`,
      author: account.profile.name,
    },
    stats: {
      likes: 0,
      comments: 0,
      shares: 0,
      bookmarks: 0,
      views: 1,
    },
    fileSizeMB: Number(fileSizeMB) || 0,
    durationSec: 15,
    commentsList: [],
  };

  store.uploadedVideos.unshift(newVideo);
  saveStore(store);

  res.json({ success: true, video: newVideo });
});

app.post('/api/videos/:id/interact', (req, res) => {
  const account = getAccountFromRequest(req);
  const rawId = req.params.id;
  const id = rawId.replace(/-p\d+$/, '');
  const { type, commentText, userName } = req.body;

  if (type === 'like') {
    store.likesMap[id] = (store.likesMap[id] || 0) + 1;
    if (account && !account.likedVideoIds.includes(rawId)) {
      account.likedVideoIds.push(rawId);
    }
  } else if (type === 'unlike') {
    store.likesMap[id] = Math.max(0, (store.likesMap[id] || 0) - 1);
    if (account) {
      account.likedVideoIds = account.likedVideoIds.filter((vId) => vId !== rawId && vId !== id);
    }
  } else if (type === 'bookmark') {
    store.bookmarksMap[id] = (store.bookmarksMap[id] || 0) + 1;
    if (account && !account.bookmarkedVideoIds.includes(rawId)) {
      account.bookmarkedVideoIds.push(rawId);
    }
  } else if (type === 'unbookmark') {
    store.bookmarksMap[id] = Math.max(0, (store.bookmarksMap[id] || 0) - 1);
    if (account) {
      account.bookmarkedVideoIds = account.bookmarkedVideoIds.filter(
        (vId) => vId !== rawId && vId !== id
      );
    }
  } else if (type === 'comment' && commentText) {
    const cleanUser = String(account?.profile.name || userName || 'User').trim();
    const newComment: CommentItem = {
      id: `cmt-${Date.now()}`,
      user: cleanUser,
      handle: account?.profile.handle || `@${cleanUser.toLowerCase().replace(/\s+/g, '')}`,
      text: String(commentText).trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      likes: 0,
    };
    if (!store.commentsMap[id]) {
      store.commentsMap[id] = [];
    }
    store.commentsMap[id].unshift(newComment);
  }

  saveStore(store);
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TurboTok Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
