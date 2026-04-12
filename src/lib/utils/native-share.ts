import { Capacitor } from '@capacitor/core';

export async function nativeShare(options: { title?: string; text?: string; url?: string; files?: File[] }): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({
      title: options.title,
      text: options.text,
      url: options.url,
      dialogTitle: options.title,
    });
    return true;
  } catch {
    return false;
  }
}

export async function triggerHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}
