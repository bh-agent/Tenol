# TODOS

## P1 - Pre-Deploy

- [x] **Fix max_participants race condition** — Add PostgreSQL function that atomically checks participant count before insert. Current code checks in JS then inserts, allowing over-capacity under concurrent joins. Effort: S (CC: ~15 min). Depends on: nothing. Context: `src/lib/actions/matches.ts` joinMatch function.

## P1.5 - Pre-Onboarding

- [x] **Create DESIGN.md** — Document existing design system: color tokens (#00E676 primary, #0A0A0A bg, etc.), typography (Pretendard Variable), spacing scale, component variants (button, card glow/glass, badge), animation patterns (stagger, fade-in, glow). Foundation for consistent iteration. Effort: S (CC: ~10 min). Context: Design system lives only in globals.css.

- [x] **Accessibility audit (touch targets + contrast)** — Ensure all interactive elements are 44px min touch target. Audit green (#00E676) on dark (#0A0A0A) contrast for small text. Fix filter chips and small buttons. Effort: S (CC: ~20 min). Context: Mobile-first app used by 40-60 year old tennis players on court.

- [x] **Add success celebrations** — Celebration screen/animation after club creation ("클럽이 생성되었습니다!") and first member join. Delight moment that builds emotional attachment. Effort: S (CC: ~15 min). Context: Currently just redirects with no celebration.

- [x] **Add stats link to club detail page** — Club stats page exists at /clubs/[clubId]/stats but has no entry point from the club detail page. Add a link/button. Effort: S (CC: ~5 min).

## P2 - Post-First-10-Clubs

- [ ] **Add test suite** — Server action tests (auth/permission checks), draw engine unit tests, API route tests. Minimum: test every server action's auth guard and permission check. Effort: M (CC: ~30 min). Context: No tests exist currently. Start with `src/lib/draw-engine/index.ts` (pure functions, easy to test) and `src/lib/actions/matches.ts` (most complex action file).

- [ ] **Add error tracking (Sentry)** — Production error visibility beyond Vercel logs. Track unhandled exceptions, server action failures, and client-side errors. Effort: S (CC: ~15 min). Context: Currently zero production error visibility.

## P3 - Growth Phase

- [ ] **Club announcements/communication feed** — Bulletin board per club. Manager posts, members comment. Uses Supabase Realtime. See design doc for full spec. Effort: M (CC: ~2-3 days). Depends on: learning from first 10 clubs whether this is actually needed.

- [ ] **Push notifications (Web Push API)** — PWA push for match updates, draw publications, announcements. iOS limitation: requires home screen install. Effort: M (CC: ~1-2 days).

- [ ] **Cross-club features** — Club discovery, inter-club matches, shared player pools. The network effect thesis depends on this. Effort: L (CC: ~1 week). Depends on: 10+ active clubs.

- [ ] **Payment/subscription infrastructure** — Freemium model. Free for small clubs, paid for 20+ members. Korean PG integration needed. Effort: XL (CC: ~L).
