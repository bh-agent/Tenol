import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/ui/toast-provider';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { KeyboardScrollFix } from '@/components/native/keyboard-scroll-fix';
import ServiceWorkerRegister from '@/components/pwa/sw-register';
import InstallPrompt from '@/components/pwa/install-prompt';
import { THEME_BACKGROUND, THEME_INIT_SCRIPT } from '@/lib/theme/theme';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tenol-one.vercel.app'),
  title: '테놀 - 테니스 치며 놀자',
  description: '테니스 클럽 운영을 더 쉽고 즐겁게. 게스트 구인, 대진표, 경기 기록, MVP까지 한 번에.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    // default: iOS 홈화면 PWA 상태바가 OS 외형(라이트/다크)을 따라감.
    // black-translucent는 글자가 항상 흰색이라 라이트 테마에서 안 보인다. (네이티브 앱은 무관)
    statusBarStyle: 'default',
    title: '테놀',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  // og:image는 src/app/opengraph-image.tsx(1200×630)가 자동 주입. 여기서 images를 지정하면 그걸 덮어쓰므로 비워둔다.
  openGraph: {
    title: '테놀 - 테니스 치며 놀자',
    description: '테니스 클럽 운영을 더 쉽고 즐겁게. 게스트 구인, 대진표, 경기 기록, MVP까지 한 번에.',
    siteName: '테놀',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '테놀 - 테니스 치며 놀자',
    description: '테니스 클럽 운영을 더 쉽고 즐겁게.',
  },
  // iOS Safari 스마트 앱 배너 (App Store 등록 후 NEXT_PUBLIC_APP_STORE_ID 설정 시)
  ...(process.env.NEXT_PUBLIC_APP_STORE_ID
    ? { other: { 'apple-itunes-app': `app-id=${process.env.NEXT_PUBLIC_APP_STORE_ID}` } }
    : {}),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 핀치 줌 허용 — 접근성(WCAG 1.4.4) 및 40~60대 사용자 가독성.
  // iOS 자동 확대는 globals.css의 input/textarea/select font-size:max(16px,1em) 규칙으로 차단.
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  // 초기값은 다크. 런타임에 src/lib/theme이 <meta name="theme-color">를 테마에 맞춰 갱신한다.
  themeColor: THEME_BACKGROUND.dark,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme: 서버는 항상 dark로 렌더하고, head의 인라인 스크립트가 첫 페인트 전에
    // 저장된 선호(라이트/시스템)로 바꾼다. React가 그 속성 차이를 경고하지 않도록
    // suppressHydrationWarning. (테마 전환 자체는 src/lib/theme/theme-store가 담당)
    <html lang="ko" className="h-full bg-background" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans antialiased">
        <ToastProvider>
          <OfflineBanner />
          {children}
        </ToastProvider>
        <ServiceWorkerRegister />
        <InstallPrompt />
        <KeyboardScrollFix />
      </body>
    </html>
  );
}
