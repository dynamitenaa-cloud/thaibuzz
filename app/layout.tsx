import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai, Prompt } from 'next/font/google';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Ticker from '@/components/Ticker';
import JsonLd from '@/components/JsonLd';
import { SITE } from '@/lib/site';

const body = Noto_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '600'], variable: '--font-body', display: 'optional' });
const head = Prompt({ subsets: ['thai', 'latin'], weight: ['600', '700'], variable: '--font-head', display: 'optional' });

// <meta ... content="값" /> 태그 전체를 붙여넣어도 content 값만 추출
const rawVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '';
const googleVerification = (rawVerification.match(/content=["']([^"']+)["']/)?.[1] ?? rawVerification).trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: '/', types: { 'application/rss+xml': '/feed.xml' } },
  openGraph: { type: 'website', siteName: SITE.name, locale: SITE.locale, url: '/', title: `${SITE.name} — ${SITE.tagline}`, description: SITE.description },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  formatDetection: { telephone: false },
  // Search Console 소유권 확인 (HTML 태그 방식). GitHub Variables 의 GOOGLE_SITE_VERIFICATION 값
  verification: googleVerification ? { google: googleVerification } : undefined,
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d12' },
  ],
};

// ตั้งธีมก่อน paint เพื่อไม่ให้หน้าจอกระพริบ
const themeInit = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${body.variable} ${head.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {SITE.adsense && (
          <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsense}`} crossOrigin="anonymous" />
        )}
        {SITE.gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}`} />
            <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${SITE.gaId}');` }} />
          </>
        )}
      </head>
      <body>
        <a href="#main" className="skip">ข้ามไปยังเนื้อหา</a>
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@graph': [
              { '@type': 'NewsMediaOrganization', '@id': `${SITE.url}/#org`, name: SITE.name, url: SITE.url, logo: `${SITE.url}/icon-512.png`, publishingPrinciples: `${SITE.url}/editorial-policy/`, correctionsPolicy: `${SITE.url}/editorial-policy/#corrections` },
              { '@type': 'WebSite', '@id': `${SITE.url}/#web`, url: SITE.url, name: SITE.name, inLanguage: 'th', publisher: { '@id': `${SITE.url}/#org` }, potentialAction: { '@type': 'SearchAction', target: `${SITE.url}/search/?q={q}`, 'query-input': 'required name=q' } },
            ],
          }}
        />
        <Header />
        <Ticker />
        <main id="main" className="wrap">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
