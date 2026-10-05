'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './Icons';

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname() || '/';
  const norm = (s: string) => (s.endsWith('/') ? s : s + '/');
  return (
    <nav className="nav" aria-label="หมวดหมู่">
      {items.map((i) => {
        const active = i.href === '/' ? path === '/' : norm(path).startsWith(i.href);
        return (
          <a key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>
            {i.label}
          </a>
        );
      })}
    </nav>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setDark(t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch {}
  };
  return (
    <button className="icon-btn" onClick={toggle} aria-label={dark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}>
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
