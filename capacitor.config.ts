import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.tenol.club',
  appName: '테놀',
  webDir: 'out',
  server: {
    url: 'https://tenol-one.vercel.app',
    cleartext: false,
    errorPath: '/offline.html',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0A0A0A',
      showSpinner: false,
      launchAutoHide: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0A0A',
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
  ios: {
    // never: CSS env(safe-area-inset-*) + .safe-top 방식과 충돌하는 네이티브 인셋 비활성
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'tenol',
    backgroundColor: '#0A0A0A',
    // 롱프레스 시 vercel.app URL 미리보기 시트가 떠서 네이티브 느낌을 깨는 것 방지
    allowsLinkPreview: false,
  },
  android: {
    backgroundColor: '#0A0A0A',
    allowMixedContent: false,
  },
};

export default config;
