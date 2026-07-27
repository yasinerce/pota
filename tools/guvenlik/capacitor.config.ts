import type { CapacitorConfig } from '@capacitor/cli';

/* Yayın derlemesi için sertleştirilmiş yapılandırma.
   Geliştirme sırasında webContentsDebuggingEnabled'ı geçici açabilirsin,
   ama mağazaya giden derlemede KAPALI olmalı. */

const config: CapacitorConfig = {
  appId: 'com.ornek.pota',
  appName: 'POTA',
  webDir: 'www',

  android: {
    // Cihazı USB ile bağlayıp Chrome DevTools ile içeriye girmeyi engeller.
    webContentsDebuggingEnabled: false,
    // Şifresiz HTTP trafiğini reddet.
    allowMixedContent: false,
    // Uygulama kendi şemasıyla servis edilsin (dosya sistemi kökünden değil).
    // Bu, CSP 'self' direktifinin anlamlı olmasını sağlar.
    // (Varsayılan zaten https, açıkça belirtiyoruz.)
  },

  ios: {
    webContentsDebuggingEnabled: false,
    contentInset: 'never',
  },

  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // Uzak sunucudan içerik yükleme; oyun tamamen paketin içinde olmalı.
    // url ve cleartext ASLA açılmamalı.
    cleartext: false,
  },
};

export default config;
