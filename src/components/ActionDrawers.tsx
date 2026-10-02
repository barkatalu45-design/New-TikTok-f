import React, { useState, useRef } from 'react';
import {
  TikTokShareArrowIcon,
  TikTokDownloadIcon,
} from './TikTokIcons';

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
  socialBadge?: string;
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

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (newVideo: VideoFeedItem) => void;
  authToken?: string;
  accountName?: string;
  accountHandle?: string;
  onRequireAuth?: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploaded,
  authToken = '',
  accountName = '',
  accountHandle = '',
  onRequireAuth,
}) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('for-you');
  const [realSizeMB, setRealSizeMB] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  if (!authToken || !accountHandle) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
        <div className="w-full max-w-md bg-[#131620] border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 text-[#F8FAFC] shadow-2xl text-center space-y-4">
          <h2 className="font-display text-lg font-bold text-white">
            Account Required to Upload
          </h2>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Bina account ke video upload nahi ho sakti. Apne TikTok account mein Log In ya Sign Up karein taake aapki video aapke apne account ({accountHandle || '@username'}) par save ho.
          </p>
          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-semibold text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onRequireAuth) onRequireAuth();
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#FE2C55] text-xs font-bold text-white cursor-pointer"
            >
              Log In / Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setSelectedFileName(file.name);

    const actualMB = Number((file.size / (1024 * 1024)).toFixed(2));
    setRealSizeMB(actualMB);

    if (file.size <= 25 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setVideoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } else {
      const blobUrl = URL.createObjectURL(file);
      setVideoUrl(blobUrl);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) {
      setErrorMsg('Please select a video file from your phone gallery or camera.');
      return;
    }
    if (!caption.trim()) {
      setErrorMsg('Please enter a video caption.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/videos/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authToken,
        },
        body: JSON.stringify({
          videoUrl,
          caption,
          category,
          fileSizeMB: realSizeMB,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.video) {
        throw new Error(data.error || 'Upload failed');
      }
      onUploaded(data.video);
      setVideoUrl('');
      setSelectedFileName('');
      setCaption('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not upload video');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#131620] border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 text-[#F8FAFC] shadow-2xl">
        <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="font-display text-base font-bold">Upload Video</h2>
            <p className="text-[11px] text-[#25F4EE]">
              Posting to account: {accountName} ({accountHandle})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xs text-[#94A3B8] hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-white/20 hover:border-[#25F4EE] rounded-2xl p-5 text-center cursor-pointer transition-colors bg-[#090A0F]"
          >
            <p className="text-sm font-semibold text-white">
              {selectedFileName ? selectedFileName : 'Tap to Choose Video from Gallery / Camera'}
            </p>
            {realSizeMB > 0 && (
              <p className="text-xs text-[#25F4EE] mt-1 font-mono-num">
                File Size: {realSizeMB} MB
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              Caption
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write video caption..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0F] border border-white/10 text-sm text-white focus:outline-none focus:border-[#25F4EE]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0F] border border-white/10 text-sm text-white focus:outline-none focus:border-[#25F4EE]"
            >
              <option value="for-you">For You</option>
              <option value="comedy">Comedy</option>
              <option value="cricket">Cricket</option>
              <option value="cars">Cars</option>
              <option value="shayari">Shayari</option>
            </select>
          </div>

          {errorMsg && <p className="text-xs text-[#FE2C55] font-medium">{errorMsg}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl bg-[#FE2C55] hover:bg-[#e02449] text-white font-semibold text-sm flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Uploading...' : `Post to ${accountHandle}`}
          </button>
        </form>
      </div>
    </div>
  );
};

interface ShareDrawerProps {
  video: VideoFeedItem | null;
  onClose: () => void;
  onDownloadNoWatermark: (video: VideoFeedItem) => void;
}

export const ShareDrawer: React.FC<ShareDrawerProps> = ({
  video,
  onClose,
  onDownloadNoWatermark,
}) => {
  const [copied, setCopied] = useState(false);

  if (!video) return null;

  const shareUrl = video.videoUrl;

  const handleCopy = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = `${video.caption} - ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#131620] border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 text-[#F8FAFC] shadow-2xl">
        <div className="w-10 h-1.5 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <TikTokShareArrowIcon className="w-5 h-5" />
            <h3 className="font-display text-base font-bold">Share Video</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs text-[#94A3B8] hover:text-white cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 my-4">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#090A0F] border border-white/10 hover:border-[#10B981] transition-colors text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0">
              <TikTokShareArrowIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Send on WhatsApp</p>
              <p className="text-[11px] text-[#94A3B8]">Share direct video link</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onDownloadNoWatermark(video);
              onClose();
            }}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#090A0F] border border-white/10 hover:border-[#25F4EE] transition-colors text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-[#25F4EE]/15 text-[#25F4EE] flex items-center justify-center shrink-0">
              <TikTokDownloadIcon className="w-5 h-5" active />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Download MP4 Without Watermark</p>
              <p className="text-[11px] text-[#25F4EE]">
                {video.fileSizeMB > 0 ? `${video.fileSizeMB} MB` : 'Direct MP4 File'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#090A0F] border border-white/10 hover:border-white/30 transition-colors text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path
                  d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                {copied ? 'Copied!' : 'Copy Video Stream Link'}
              </p>
              <p className="text-[11px] text-[#94A3B8]">Copy direct URL</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
