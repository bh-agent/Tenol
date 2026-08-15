import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.tenol.club',
  appName: '테놀',
  webDir: 'out',
  // 딥링크(app.tenol.club://) 지원 빌드 식별용 마커.
  // 로그인 페이지가 이 UA 유무로 신·구 빌드를 구분해 OAuth 방식을 선택한다.
  // (구버전 앱 = URL scheme 미등록 → 딥링크 대신 WebView 내 직접 진행)
  appendUserAgent: 'TenolApp/2',
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
