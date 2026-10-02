import React from 'react';

interface IconProps {
  className?: string;
  active?: boolean;
}

/**
 * Authentic sculpted TikTok Vector Heart (Zero emoji, pure geometric SVG path with optional active fill & glow)
 */
export const TikTokHeartIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', active = false }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-transform duration-150 ${active ? 'scale-110' : ''} ${className}`}
  >
    <path
      d="M16 27.6C15.5 27.6 15.02 27.42 14.64 27.08C10.18 23.12 3.5 17.22 3.5 11.2C3.5 6.82 6.88 3.5 11.05 3.5C13.38 3.5 15.12 4.62 16 5.88C16.88 4.62 18.62 3.5 20.95 3.5C25.12 3.5 28.5 6.82 28.5 11.2C28.5 17.22 21.82 23.12 17.36 27.08C16.98 27.42 16.5 27.6 16 27.6Z"
      fill={active ? '#FE2C55' : 'rgba(255, 255, 255, 0.94)'}
      stroke={active ? '#FE2C55' : 'rgba(15, 23, 42, 0.35)'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {active && (
      <path
        d="M10.8 7.2C8.7 7.2 7.2 8.7 7.2 10.8"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    )}
  </svg>
);

/**
 * Authentic TikTok Right-Curved Forward Share Arrow SVG
 */
export const TikTokShareArrowIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M18.6 5.2L28.4 14.3C29.1 14.95 29.1 16.05 28.4 16.7L18.6 25.8C17.55 26.78 15.85 26.03 15.85 24.6V20.2C9.2 20.2 4.9 22.4 3.2 26.5C2.85 27.35 1.55 26.95 1.75 26.02C3.15 18.2 8.2 11.4 15.85 10.7V6.4C15.85 4.97 17.55 4.22 18.6 5.2Z"
      fill="rgba(255, 255, 255, 0.94)"
      stroke="rgba(15, 23, 42, 0.35)"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Authentic TikTok Rounded Speech Bubble Comment SVG with 3 Dots
 */
export const TikTokCommentIcon: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M16 4.2C9.15 4.2 3.6 9.15 3.6 15.25C3.6 18.25 4.95 20.97 7.15 22.96L5.85 27.15C5.62 27.9 6.36 28.56 7.08 28.23L11.75 26.08C13.1 26.42 14.52 26.6 16 26.6C22.85 26.6 28.4 21.65 28.4 15.55C28.4 9.45 22.85 4.2 16 4.2Z"
      fill="rgba(255, 255, 255, 0.94)"
      stroke="rgba(15, 23, 42, 0.35)"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx="11.2" cy="15.4" r="1.6" fill="#090A0F" />
    <circle cx="16" cy="15.4" r="1.6" fill="#090A0F" />
    <circle cx="20.8" cy="15.4" r="1.6" fill="#090A0F" />
  </svg>
);

/**
 * Authentic TikTok Bookmark Ribbon Vector Icon
 */
export const TikTokBookmarkIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', active = false }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-transform duration-150 ${active ? 'scale-110' : ''} ${className}`}
  >
    <path
      d="M7.5 5.8C7.5 4.53 8.53 3.5 9.8 3.5H22.2C23.47 3.5 24.5 4.53 24.5 5.8V26.8C24.5 27.76 23.42 28.32 22.63 27.77L16.57 23.54C16.23 23.3 15.77 23.3 15.43 23.54L9.37 27.77C8.58 28.32 7.5 27.76 7.5 26.8V5.8Z"
      fill={active ? '#FACC15' : 'rgba(255, 255, 255, 0.94)'}
      stroke={active ? '#FACC15' : 'rgba(15, 23, 42, 0.35)'}
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Clean No-Watermark HD Video Download Vector Icon (For 1-Tap WhatsApp Status Saver)
 */
export const TikTokDownloadIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', active = false }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M16 4.5V19.5M16 19.5L10.2 13.7M16 19.5L21.8 13.7"
      stroke={active ? '#25F4EE' : '#FFFFFF'}
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 22.5V24.5C6 25.88 7.12 27 8.5 27H23.5C24.88 27 26 25.88 26 24.5V22.5"
      stroke={active ? '#25F4EE' : '#FFFFFF'}
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Vector Boost Bolt / Flame Icon (Replaces cheap rocket/fire emojis)
 */
export const TikTokBoostIcon: React.FC<IconProps> = ({ className = 'w-7 h-7', active = false }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M17.8 3.5L6.8 17.5H15.5L14.2 28.5L25.2 14.5H16.5L17.8 3.5Z"
      fill={active ? '#25F4EE' : 'rgba(255, 255, 255, 0.92)'}
      stroke={active ? '#25F4EE' : 'rgba(15, 23, 42, 0.4)'}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Iconic TikTok Dual-Layered Cyan (#25F4EE) & Crimson (#FE2C55) Create (+) Button
 */
export const TikTokCreatePlusButton: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Upload Video"
    className="relative flex items-center justify-center w-12 h-8 active:scale-95 transition-transform cursor-pointer group"
  >
    {/* Left Cyan Offset Layer */}
    <span className="absolute inset-y-0 left-0 w-10 rounded-lg bg-[#25F4EE] transition-transform group-hover:-translate-x-0.5" />
    {/* Right Crimson Offset Layer */}
    <span className="absolute inset-y-0 right-0 w-10 rounded-lg bg-[#FE2C55] transition-transform group-hover:translate-x-0.5" />
    {/* Center Crisp White Pill */}
    <span className="relative z-10 flex items-center justify-center w-10 h-full rounded-lg bg-white text-[#090A0F] shadow-sm">
      <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
        <path
          d="M10 4.2V15.8M4.2 10H15.8"
          stroke="#090A0F"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  </button>
);

/**
 * Spinning Vinyl Disc SVG with Audio Groove Rings
 */
export const SpinningVinylDisc: React.FC<{ isPlaying: boolean; authorName: string }> = ({
  isPlaying,
  authorName,
}) => {
  const initials = authorName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative flex items-center justify-center w-11 h-11">
      <div
        className={`w-11 h-11 rounded-full bg-gradient-to-tr from-[#11131C] via-[#262936] to-[#11131C] p-1.5 border border-white/20 shadow-lg flex items-center justify-center ${
          isPlaying ? 'animate-spin' : ''
        }`}
        style={{ animationDuration: '5.5s' }}
      >
        <div className="w-full h-full rounded-full border border-white/10 flex items-center justify-center bg-gradient-to-br from-[#FE2C55] to-[#25F4EE]">
          <span className="text-[9px] font-bold text-[#090A0F] tracking-tighter font-mono">
            {initials || 'TT'}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Verified Creator Checkmark SVG
 */
export const VerifiedBadgeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 20 20" fill="none" className={className}>
    <circle cx="10" cy="10" r="9" fill="#25F4EE" />
    <path
      d="M6.3 10.2L8.7 12.6L13.8 7.5"
      stroke="#090A0F"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Brand Mark Logo SVG (Dual-Wave Pulse Icon)
 */
export const TurboTokBrandMark: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 28 28" fill="none" className={className}>
    <rect x="2" y="2" width="24" height="24" rx="7" fill="#131620" stroke="rgba(255,255,255,0.12)" />
    <path
      d="M16.5 6.5V17.2C16.5 19.3 14.8 21 12.7 21C10.6 21 8.9 19.3 8.9 17.2C8.9 15.1 10.6 13.4 12.7 13.4"
      stroke="#25F4EE"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M17.7 7.5C18.6 9.5 20.2 10.8 22.2 11.1M15.3 6.5V17.2C15.3 19.3 13.6 21 11.5 21"
      stroke="#FE2C55"
      strokeWidth="2.3"
      strokeLinecap="round"
    />
  </svg>
);
