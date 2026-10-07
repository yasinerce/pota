# POTA — Döküm Ocağı

Fizik tabanlı birleştirme oyunu. Tek dosya, HTML5 Canvas + Matter.js.

**▶ [Oyna](https://yasinerce.github.io/pota/)**

<!-- Yukarıdaki bağlantıyı kendi kullanıcı adınla değiştir -->

---

## Nedir

Aynı iki metali birleştir, bir üst kademeye çık. Potayı taşırma.

Kum → Cevher → Kurşun → Bakır → Bronz → Kobalt → Demir → Gümüş → Altın →
Platin → Yıldız çeliği

Birleştirmeler potayı **ısıtır**. Isı hem puan çarpanı hem yetenek yakıtıdır:
Ateşle (bir cismi buharlaştır), Çekiçle (potayı salla), Ergit (en kalabalık
kademeyi birleştir). Arada düşen **cüruf** birleşmez ama yanarak erir. Pota
ilerledikçe daralır.

## Günlük mod

Taş sırası tohumlu bir üreticiden gelir. Günlük modda tohum o günün tarihidir,
yani **herkes aynı sırayı oynar** — skorlar gerçekten karşılaştırılabilir.

Dağıtıcı garantileri (60.000 dökümle doğrulandı):
- Her kademenin potaya soktuğu toplam alan yaklaşık eşit
- Her 24 dökümde her kademe çift adet gelir — eşleşemeyecek taş kalmaz
- Üç aynı taş asla arka arkaya gelmez

## Çalıştırma

`index.html` dosyasını tarayıcıda aç. Derleme adımı yok.

Kontroller: sürükle-bırak · ok tuşları + boşluk · **D** fizik hata ayıklama

## Belgeler

- [`docs/BENIOKU.md`](docs/BENIOKU.md) — ayar sabitleri, mimari notlar, yayın adımları
- [`docs/GUVENLIK.md`](docs/GUVENLIK.md) — güvenlik denetimi
- [`tools/dogrulama/`](tools/dogrulama/) — tekrar doğrulayıcı (sıralama tablosu için)

## Durum

Sürüm 1.0.0. **Henüz gerçek cihazda test edilmedi** — balans değerleri
doğrulanmamış tahminlerdir.

Tamamlanmamış: paylaşım görseli, sıralama tablosu, günlük modda tek deneme
sınırı, çevrimdışı paketleme (matter.js ve fontlar hâlâ CDN'den).

## Lisans

<!-- Bir lisans seç. Hiç lisans koymazsan yasal olarak "tüm hakları saklı"
     sayılır ve kimse kodu kullanamaz. Açık olsun istiyorsan MIT yaygın. -->
