# POTA — Döküm Ocağı

Fizik tabanlı birleştirme oyunu. Tek dosya, HTML5 Canvas + Matter.js.
Sürüm 1.0.0

---

## ÖNCE OKU

**Bu oyun hiçbir cihazda test edilmedi.** Kod sözdizimi kontrolünden ve yapısal
denetimden geçti, o kadar. Aşağıdaki her balans değeri doğrulanmamış tahmindir.
İlk iş: telefonda aç, oynat, sonra ayarla.

---

## ÇALIŞTIRMA

`pota.html` dosyasını tarayıcıda aç. Başka bir şey gerekmiyor.

**Uyarı:** Matter.js ve yazı tipleri CDN'den yükleniyor. İnternet yoksa açılmaz.
Çevrimdışı çalışması için "YAYIN HAZIRLIĞI" bölümüne bak.

Kontroller:
- Parmağını sürükle, bırak → metal düşer
- Ok tuşları + boşluk (masaüstü testi için)
- **D** tuşu → fizik hata ayıklama katmanı

---

## OYUN

Aynı iki metal çarpışınca birleşir ve bir üst kademeye çıkar. Üstteki kesikli
çizgi taşma sınırı; oraya kadar yığılırsa 1.8 saniye içinde yer açman gerekir.

11 kademe: Kum → Cevher → Kurşun → Bakır → Bronz → Kobalt → Demir → Gümüş →
Altın → Platin → Yıldız çeliği

**Isı** her birleştirmede artar, durunca soğur. Hem puan çarpanı hem yetenek
yakıtı. Üç yetenek: Ateşle (30, bir cismi buharlaştır), Çekiçle (50, potayı
salla), Ergit (75, en kalabalık kademeyi birleştir).

**Cüruf** her 11 dökümde bir düşer, birleşmez, 20 saniyede yanarak erir.
Yakındaki birleştirmeler ömrünü kısaltır.

**Pota** her 1800 puanda daralır.

---

## AYAR DEĞERLERİ

Hepsi dosyanın başında, `AYARLAR` bölümünde.

| Sabit | Şu an | Ne yapar |
|---|---|---|
| `NARROW_STEP` | 1800 | Kaç puanda bir pota daralır |
| `NARROW_AMT` | 9 | Her adımda kaç piksel daralır (0 = kapalı) |
| `SLAG_FIRST` / `SLAG_EVERY` | 14 / 11 | İlk cüruf / sonraki aralık |
| `SLAG_LIFE` | 20000 | Cüruf ömrü (ms) |
| `SLAG_MERGE_DMG` | .34 | Yakın birleşmenin cürufa verdiği hasar |
| `COMBO_WINDOW` | 2600 | Zincirin kopma süresi (ms) |
| `HEAT_DECAY` | .0032 | Isı soğuma hızı |
| `COST` | 30/50/75 | Yetenek maliyetleri |
| `ROLL_DAMP` | .975 | Dönme sönümü — düşürmek yuvarlanmayı azaltır |
| `SETTLE_SPEED/DAMP` | .42 / .22 | Oturmuş cismin yatay hız kelepçesi |
| `BAG` | [5,3,2,1,1] | Torbadaki kademe adetleri |
| `DPR_MAX` | 4 | Çizim çözünürlüğü tavanı (düşürmek performans kazandırır) |

`TIERS` dizisinde her kademenin yarıçapı, rengi, `rough` (0 ayna, 1 mat) ve
`metal` (1 metal, 0 dielektrik) değerleri var. Görünüm değiştirmek için
`rough`'u oynatmak yeterli.

---

## MİMARİ NOTLAR

**Sabit zaman adımı.** Fizik her zaman 60 Hz'te koşar, biriktirici (accumulator)
ile. Matter.js değişken adıma dayanıklı değildir; gerçek kare süresini doğrudan
vermek titreme ve cihazdan cihaza farklı davranış üretir.

**Uyku kipi KAPALI ve öyle kalmalı.** Matter'da uyuyan cisme yerçekimi
uygulanmaz, ancak çarpışma uyandırır. Bu oyunda altındaki toplar birleşerek yok
oluyor; destek kaybolduğunda çarpışma olayı doğmadığı için üstteki top havada
asılı kalıyordu.

**Birleşme konumu.** Yeni külçe orta noktada değil, alttaki külçenin yerinde
doğar ve yarıçap farkı kadar yukarı kaydırılır. Kule aşağı çökmez, yukarı büyür.

**Küre gölgelendirmesi.** Her kademe bir kez piksel piksel pişirilir (çevre
yansıması, Fresnel, spekülar, pürüzlülük), sonra sadece kopyalanır. Sprite
çözünürlüğü cihaz pikseline eşitlenir. İlk 5 kademe anında, kalanlar kare
başına bir tane arka planda pişer.

**Dağıtıcı.** Tohumlu RNG + ağırlıklı torba. Her 24 dökümde her kademe çift
adet gelir (öksüz taş yok), üç aynı taş asla arka arkaya gelmez, alan payları
dengelidir. 60.000 dökümle doğrulandı.

---

## YAYIN HAZIRLIĞI

Yapılması gerekenler, sırayla:

### 1. Çevrimdışı çalıştır

```bash
npm i matter-js
```

`<script src="https://cdnjs...">` satırını yerel dosyayla değiştir.

Üç yazı tipini (`Big Shoulders Display`, `Saira Stencil One`, `IBM Plex Mono`)
`.woff2` olarak indir, `<link>` yerine `@font-face` ile tanımla.

### 2. Kalıcı kayıt

`Store` şu an bellek içi — sayfa yenilenince rekorlar ve ipuçları sıfırlanır.
Dosyanın başındaki yorum bloğunda iki hazır adaptör var.

**Capacitor için `localStorage` kullanma**, WebView onu habersiz temizleyebilir:

```bash
npm i @capacitor/preferences
```

Yorum bloğundaki Preferences adaptörünü aç, açılışta `hydrate()` çağır.

### 3. Mağaza

İkon, ekran görüntüleri, açıklama, **gizlilik politikası** (Google Play zorunlu
tutuyor).

---

## GÜVENLİK

Ayrıntı: `GUVENLIK.md`

Özet:
- **Tek somut açık:** matter.js ve fontlar CDN'den geliyor. Capacitor'da bu
  cihaz seviyesi risk demek. Yerel paketleme hem çevrimdışı çalışmayı hem bu
  riski çözüyor — aynı iş.
- CSP eklendi, `innerHTML` kaldırıldı, Capacitor sertleştirme dosyaları hazır.
- Oyun artık **tekrar kaydı** tutuyor (girdi dizisi + fizik adımı). Sıralama
  tablosu yaparsan skoru istemciden almak yerine bunu doğrulat.
  `dogrulama/dogrula.js` yapısal denetimi yapıyor.

## PAKET İÇERİĞİ

```
pota.html                       oyun (tek dosya)
BENIOKU.md                      bu dosya
GUVENLIK.md                     güvenlik denetimi ve yapılacaklar
guvenlik/
  capacitor.config.ts           sertleştirilmiş yapılandırma
  android-sertlestirme.md       manifest ve izin notları
  sri-olustur.sh                SRI hash üretici
dogrulama/
  dagitici.js                   oyundan çıkarılmış dağıtıcı
  dogrula.js                    tekrar doğrulayıcı
```

## TAMAMLANMAMIŞ

**Günlük tohum yarım.** Bugün herkes aynı sırayı oynuyor ama karşılaştıracak
yer yok. Eksikler:

1. Paylaşım görseli (düz metin değil, emoji ızgarası veya kare)
2. Sıralama tablosu
3. Günlük modda tek deneme sınırı

Bu üçü oyunun tek gerçek farklılaştırıcısını tamamlıyor.

**Diğer eksikler:** renk körü modu yok, titreşim kapatma seçeneği yok,
kod tek dosyada ve global değişkenlerle çalışıyor (uzun vadede modüllere
ayrılmalı — dağıtıcı ve birleşme mantığı zaten test edilebilir saf fonksiyonlar).

---

## BİLİNEN RİSKLER

- Yuvarlanma sönümü fazla sert olabilir, toplar bıraktığın yere çakılıyorsa
  `ROLL_DAMP`'i 0.985'e çıkar
- 3x ekranda bellek ~23 MB; zayıf cihazda takılırsa `DPR_MAX`'ı 2.5 yap
- iOS ses kilidi ilk dokunuşta açılıyor, gerçek cihazda doğrulanmadı
- Titreşim (`navigator.vibrate`) tarayıcıda çalışmayabilir, Capacitor'da çalışır
