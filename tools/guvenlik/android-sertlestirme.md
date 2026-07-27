# Android sertleştirme

## AndroidManifest.xml

`android/app/src/main/AndroidManifest.xml` içinde `<application>` etiketi:

```xml
<application
    android:usesCleartextTraffic="false"
    android:allowBackup="false"
    android:debuggable="false"
    ... >
```

- **usesCleartextTraffic="false"** — şifresiz HTTP'yi engeller
- **allowBackup="false"** — `adb backup` ile uygulama verisinin çekilmesini engeller
- **debuggable** — yayın derlemesinde asla true olmamalı (Gradle zaten ayarlar,
  ama elle eklenmiş bir değer varsa üzerine yazar)

## İzinler

Capacitor eklentileri manifest'e otomatik izin ekler. Yayından önce kontrol et:

```bash
grep uses-permission android/app/src/main/AndroidManifest.xml
```

Bu oyunun ihtiyacı olan izin **yok**. Titreşim bile izin gerektirmiyor
(`android.permission.VIBRATE` gerekiyorsa @capacitor/haptics eklemişsin
demektir; oyun `navigator.vibrate` kullanıyor, eklenti gerekmiyor).

Listede tanımadığın bir izin varsa, onu ekleyen eklentiyi kaldır. Her eklenti
WebView ile yerel katman arasındaki köprüye yeni yüzey ekler.

## Kod imzalama

Anahtar deposunu (`.keystore`) sürüm kontrolüne **koyma**. Kaybedersen aynı
uygulama kimliğiyle güncelleme yayınlayamazsın.

## İnceleme öncesi

```bash
npx cap sync
cd android && ./gradlew assembleRelease
```

APK'yı `apkanalyzer` veya `bundletool` ile aç, `assets/public/` içinde
beklemediğin dosya olmadığını doğrula (kaynak haritaları, yedek dosyalar,
`.env` gibi).
