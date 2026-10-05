type P = React.SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export const SearchIcon = (p: P) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const SunIcon = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const MoonIcon = (p: P) => <svg {...base} {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>;
export const LinkIcon = (p: P) => <svg {...base} {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>;
export const ShareIcon = (p: P) => <svg {...base} {...p}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>;
export const ClockIcon = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const RssIcon = (p: P) => <svg {...base} {...p}><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg>;

export const LineIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s6-3.5 8.2-6.1C21.5 14.3 22 12.7 22 11c0-4.4-4.5-8-10-8Zm-3.6 10.4H6.4a.5.5 0 0 1-.5-.5V9a.5.5 0 0 1 1 0v3.4h1.5a.5.5 0 0 1 0 1Zm2-.5a.5.5 0 0 1-1 0V9a.5.5 0 0 1 1 0v3.9Zm4.8 0a.5.5 0 0 1-.9.3l-2-2.7v2.4a.5.5 0 0 1-1 0V9a.5.5 0 0 1 .9-.3l2 2.7V9a.5.5 0 0 1 1 0v3.9Zm3.2-2.4a.5.5 0 0 1 0 1h-1.5v.9h1.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5V9c0-.3.2-.5.5-.5h2a.5.5 0 0 1 0 1h-1.5v.9h1.5Z" />
  </svg>
);
export const FbIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z" />
  </svg>
);
export const YouTubeIcon = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden {...p}>
    <path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z" />
    <path fill="#fff" d="m9.6 15.6 6.3-3.6-6.3-3.6v7.2Z" />
  </svg>
);
export const InstagramIcon = (p: P) => <svg {...base} {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>;
export const ThreadsIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M17.7 11.1c-.1 0-.2-.1-.3-.1-.2-3-1.8-4.7-4.6-4.7h-.1c-1.6 0-3 .7-3.9 2l1.5 1c.6-1 1.6-1.2 2.4-1.2 1 0 1.7.3 2.2.9.3.4.6 1 .7 1.7-.8-.1-1.6-.2-2.5-.1-2.5.1-4.1 1.6-4 3.6.1 1 .6 1.9 1.4 2.5.7.5 1.6.7 2.6.6 1.3-.1 2.3-.5 3-1.4.5-.7.9-1.5 1-2.6.6.4 1.1.9 1.3 1.5.4 1 .5 2.6-.8 3.9-1.1 1.1-2.5 1.6-4.6 1.6-2.3 0-4-.7-5.1-2.2-1-1.3-1.6-3.2-1.6-5.6s.5-4.3 1.6-5.6C7.6 3.6 9.3 2.9 11.6 2.9c2.3 0 4 .7 5.2 2.2.6.7 1 1.6 1.3 2.6l1.8-.5c-.4-1.3-.9-2.4-1.6-3.3C16.7 2 14.5 1 11.6 1 8.7 1 6.5 2 5 3.9 3.7 5.6 3 7.9 3 10.9s.7 5.3 2 7c1.5 1.9 3.7 2.9 6.6 2.9 2.6 0 4.4-.7 5.9-2.2 2-2 1.9-4.4 1.3-5.9-.4-.9-1.2-1.7-2.1-2.3Zm-4.6 4.3c-1.1.1-2.2-.4-2.3-1.4 0-.8.6-1.6 2.3-1.7h.6c.6 0 1.1.1 1.6.2-.2 2.3-1.3 2.9-2.2 2.9Z" />
  </svg>
);
export const TikTokIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M16.6 5.8a4.5 4.5 0 0 1-1-2.8h-3.3v13.4a2.8 2.8 0 1 1-2-2.7V10.3a6.1 6.1 0 1 0 5.3 6V9.6a7.8 7.8 0 0 0 4.5 1.4V7.7a4.5 4.5 0 0 1-3.5-1.9Z" />
  </svg>
);
export const XIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.2L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
  </svg>
);
