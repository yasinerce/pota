# Güvenlik notları

Denetim tarihi: 27 Temmuz 2026 · Sürüm 1.0.0

## Mevcut durum

Oyunun saldırı yüzeyi küçük: kullanıcı metin girdisi yok, ağ isteği yok,
`eval` yok, dinamik kod yükleme yok. `innerHTML` kullanımı `textContent` ve
DOM düğümleriyle değiştirildi.

## 1. Tedarik zinciri — tek somut açık

`matter.min.js` ve üç yazı tipi hâlâ CDN'den geliyor.

Tarayıcıda bu sıradan bir XSS riski. **Capacitor'da daha ağır**: WebView yerel
köprüye bağlı, yani ele geçirilen bir CDN cihaz seviyesinde erişim kazanır.

**Yapılanlar**
- CSP meta etiketi eklendi (şu an CDN'e izin veriyor)
- `crossorigin="anonymous"` eklendi (SRI'nin ön koşulu)

**Yapılacaklar**
1. **Yerel paketleme** — asıl çözüm. `npm i matter-js`, fontları `.woff2`
   indir. Sonra CSP'yi daralt: `script-src 'self'; style-src 'self'`
2. CDN'de bırakacaksan `guvenlik/sri-olustur.sh` ile hash üret ve ekle

**SRI hash'i neden boş bırakıldı:** cdnjs'in yayınladığı hash'lerin dosyayla
eşleşmediğine dair açık hata kayıtları var (cdnjs/cdnjs#14124). Yanlış hash,
hash olmamasından beterdir — tarayıcı kaynağı tamamen bloke eder, oyun açılmaz.
Doğrulanmamış bir değer yazmaktansa boş bırakıldı.

## 2. Capacitor sertleştirmesi

`guvenlik/capacitor.config.ts` ve `guvenlik/android-sertlestirme.md`.

Özet: `webContentsDebuggingEnabled: false`, `usesCleartextTraffic="false"`,
`allowBackup="false"`, kullanılmayan eklentileri kaldır.

## 3. Skor bütünlüğü — sıralama tablosu yaparsan

Oyun tamamen istemci tarafında. Skoru olduğu gibi kabul eden bir sıralama
tablosu ilk gün çöpe döner.

**Elimizdeki koz:** oyun deterministik (tohumlu RNG + sabit zaman adımı).
Skor yerine **girdi dizisi** gönderilebilir; sunucu aynı tohumla yeniden
oynatıp skoru kendisi hesaplar.

Oyun artık bu kaydı tutuyor. Biçim:

```
POTA1|<tohum>|<toplam adım>|<skor>|<adım,tür,x[,y]>;...
```

Türler: `d` bırakma, `b` ateşle, `h` çekiç, `m` ergit.
Kayıt duvar saatine göre değil **fizik adımına** göre tutulur — determinizmin şartı.

`dogrulama/dogrula.js` bu kaydı denetler.

**Yakaladıkları** (test edildi): uydurma skor, girdisiz gönderim, imkânsız
bırakma hızı, sınır dışı koordinat, bozuk biçim, yanlış tohum.

**Yakalayamadığı:** fiziği yerelde çalıştırıp mantıklı bir girdi dizisi üreten
sofistike saldırgan. Bunun için tam tekrar gerekir — oyunun çekirdeğinin ortak
bir modüle çıkarılması. Yöntem `dogrula.js` içinde yazılı.

**Uyarı:** Matter.js'in kayan nokta davranışı platformlar arası bit-bit aynı
olmayabilir. Sunucu istemciyle aynı sürümü çalıştırmalı ve küçük sapmalara
tolerans tanımalı, yoksa dürüst oyuncuları reddedersin.

## 4. Günlük tohum tahmin edilebilir

Tohum tarihten türetiliyor, yani yarının dizisi bugünden hesaplanabilir.
Yarışma ciddiyse tohumu sunucudan gelen bir tuzla üret ve gün dönümünde yayınla.

## 5. İleriye dönük

Oyuncu adı eklediğin gün: `textContent` kullanmaya devam et, `innerHTML`'e
dönme. Sunucu tarafında ad uzunluğu ve karakter kümesi sınırla.
