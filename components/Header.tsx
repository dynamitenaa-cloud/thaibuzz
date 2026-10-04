import Link from 'next/link';
import { CATEGORIES, SITE } from '@/lib/site';
import { SearchIcon } from './Icons';
import { NavLinks, ThemeToggle } from './HeaderClient';

export default function Header() {
  return (
    <header className="hdr">
      <div className="wrap hdr-in">
        <Link href="/" className="logo" aria-label={`${SITE.name} หน้าแรก`}>
          <span className="logo-mark" aria-hidden>🔥</span>
          <span>Thai<b>Buzz</b></span>
        </Link>
        <NavLinks items={[{ href: '/', label: 'หน้าแรก' }, ...CATEGORIES.map((c) => ({ href: `/category/${c.slug}/`, label: c.name }))]} />
        <div className="hdr-act">
          <Link href="/search/" className="icon-btn" aria-label="ค้นหา"><SearchIcon /></Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
