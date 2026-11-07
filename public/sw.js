// ThaiBuzz 푸시 알림 서비스 워커. 푸시에는 본문이 없어서 /api/push 에서 최신 알림을 가져와 표시
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let m = { title: 'ThaiBuzz', body: 'มีอัปเดตใหม่ในเรื่องฟุตบอลและบันเทิง', url: '/football/' };
    try { const r = await fetch('/api/push', { cache: 'no-store' }); if (r.ok) m = { ...m, ...(await r.json()) }; } catch (_) {}
    await self.registration.showNotification(m.title, { body: m.body, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: m.url }, tag: 'tb-update', renotify: true });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.openWindow(url));
});
