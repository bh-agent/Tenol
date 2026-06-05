import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/ui/toast-provider';
import { OfflineBanner } from '@/components/ui/offline-banner';
import ServiceWorkerRegister from '@/components/pwa/sw-register';
import InstallPrompt from '@/components/pwa/install-prompt';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tenol-one.vercel.app'),
  title: '테놀 - 테니스 치며 놀자',
  description: '테니스 클럽 운영을 더 쉽고 즐겁게. 게스트 구인, 대진표, 경기 기록, MVP까지 한 번에.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '테놀',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: '테놀 - 테니스 치며 놀자',
    description: '테니스 클럽 운영을 더 쉽고 즐겁게. 게스트 구인, 대진표, 경기 기록, MVP까지 한 번에.',
    siteName: '테놀',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: '테놀' }],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: '테놀 - 테니스 치며 놀자',
    description: '테니스 클럽 운영을 더 쉽고 즐겁게.',
    images: ['/icons/icon-512.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0A0A0A',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full bg-background">
      <head>
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
      </body>
    </html>
  );
}
