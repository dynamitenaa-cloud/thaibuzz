import type { Metadata } from 'next';
import { SITE } from './site';

// 페이지별 openGraph 는 레이아웃 값을 "통째로 교체"함 (병합 안 됨).
// 그래서 모든 페이지가 이 헬퍼로 site_name/locale/type/이미지를 빠짐없이 채움
type OG = NonNullable<Metadata['openGraph']>;
export function og(path: string, title: string, extra: Partial<OG> & Record<string, unknown> = {}): OG {
  return {
    type: 'website',
    siteName: SITE.name,
    locale: SITE.locale,
    url: path,
    title,
    images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: SITE.name }],
    ...extra,
  } as OG;
}
