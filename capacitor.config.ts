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
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'tenol',
    backgroundColor: '#0A0A0A',
  },
  android: {
    backgroundColor: '#0A0A0A',
    allowMixedContent: false,
  },
};

export default config;
