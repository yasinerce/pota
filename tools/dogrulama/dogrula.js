#!/usr/bin/env node
/* POTA — tekrar doğrulayıcı
   Kullanım:  node dogrula.js "POTA1|20260726|4210|1830|12,d,180.4;..."
              node dogrula.js --dosya tekrar.txt

   NE YAPAR
   Oyun deterministik olduğu için istemcinin gönderdiği skora güvenmek zorunda
   değiliz. Bu betik tekrar kaydının YAPISAL geçerliliğini denetler ve tohumdan
   taş dizisini bağımsız olarak yeniden üretir.

   NE YAPMAZ  (dürüst sınır)
   Fiziği yeniden oynatmaz, yani skoru bağımsız olarak HESAPLAMAZ. Bunun için
   oyunun çekirdeğinin (fizik + birleşme + puanlama) ortak bir modüle
   çıkarılması gerekir; aşağıda "SONRAKİ ADIM" bölümüne bak.

   Bugünkü haliyle yakaladıkları: uydurma skor, girdisiz gönderim, imkânsız
   bırakma hızı, sınır dışı koordinat, tutarsız adım sayacı, yanlış tohum.
   Yakalayamadığı: fiziği yerelde çalıştırıp mantıklı bir girdi dizisi üreten
   sofistike saldırgan. Onun için tam tekrar şart.                            */

'use strict';
const D = require('./dagitici.js');

// ── Oyundan gelen sabitler. Oyun dosyasındaki AYARLAR bölümüyle EŞ olmalı. ──
const W = 400, FIXED = 1000 / 60;
const BASE_INSET = 46;
const DROP_CD = 360;
const TIER_R = [14, 18, 23, 29, 35, 42, 50, 59, 69, 80, 92];
const MAXT = TIER_R.length - 1;
const SPAWNABLE = 5;
const MAX_MULT = 3;

const MIN_DROP_STEPS = Math.floor(DROP_CD / FIXED) - 1;   // bırakma bekleme süresi
const MAX_SCORE_PER_MERGE = (MAXT + 1) * 10 * MAX_MULT;   // en iyi ihtimalle

function parse(str) {
  const p = String(str).trim().split('|');
  if (p.length !== 5 || p[0] !== 'POTA1') throw new Error('Biçim tanınmadı');
  const [, seed, stepsS, scoreS, body] = p;
  if (!/^[0-9A-Z]{4,12}$/.test(seed)) throw new Error('Tohum biçimi geçersiz');
  const steps = Number(stepsS), score = Number(scoreS);
  if (!Number.isInteger(steps) || steps < 0) throw new Error('Adım sayacı geçersiz');
  if (!Number.isInteger(score) || score < 0) throw new Error('Skor geçersiz');

  const events = body ? body.split(';').map((e, i) => {
    const f = e.split(',');
    if (f.length < 3) throw new Error(`Olay ${i}: eksik alan`);
    const ev = { s: Number(f[0]), t: f[1], x: Number(f[2]) };
    if (f.length > 3) ev.y = Number(f[3]);
    if (!Number.isInteger(ev.s) || ev.s < 0) throw new Error(`Olay ${i}: adım geçersiz`);
    if (!'dbhm'.includes(ev.t)) throw new Error(`Olay ${i}: bilinmeyen tür "${ev.t}"`);
    if (!Number.isFinite(ev.x)) throw new Error(`Olay ${i}: koordinat geçersiz`);
    return ev;
  }) : [];
  return { seed, steps, score, events };
}

function verify(str) {
  const r = parse(str);
  const notlar = [];
  const hata = [];

  // 1. Adım sacayı tutarlı mı
  let prev = -1;
  for (const e of r.events) {
    if (e.s < prev) hata.push('Olaylar adım sırasına göre değil');
    prev = e.s;
  }
  if (prev > r.steps) hata.push('Bir olay bildirilen toplam adım sayısını aşıyor');

  // 2. Bırakmalar: bekleme süresi ve sınırlar
  const deal = D.dealer(r.seed);
  const drops = r.events.filter(e => e.t === 'd');
  let lastDrop = -1e9;
  drops.forEach((e, i) => {
    if (e.s - lastDrop < MIN_DROP_STEPS)
      hata.push(`Bırakma ${i}: bekleme süresine uyulmamış (${e.s - lastDrop} adım)`);
    lastDrop = e.s;
    const tier = deal();
    if (tier < 0 || tier >= SPAWNABLE) hata.push(`Bırakma ${i}: dağıtıcı geçersiz kademe verdi`);
    const rad = TIER_R[tier];
    // Pota yalnızca daralır; en gevşek sınır başlangıç genişliğidir.
    if (e.x < BASE_INSET + rad - 1 || e.x > W - BASE_INSET - rad + 1)
      hata.push(`Bırakma ${i}: x=${e.x} potanın dışında (kademe ${tier})`);
  });

  // 3. Skor üst sınırı
  // Her bırakma sahaya bir taş sokar; birleşme sayısı bırakma sayısını aşamaz.
  const tavan = drops.length * MAX_SCORE_PER_MERGE;
  if (r.score > tavan)
    hata.push(`Skor imkânsız: ${r.score} > tavan ${tavan} (${drops.length} bırakma)`);

  // 4. Süre tutarlılığı
  const sure = r.steps * FIXED / 1000;
  if (drops.length && sure < drops.length * (DROP_CD / 1000) * 0.9)
    hata.push(`Süre yetersiz: ${sure.toFixed(1)} sn içinde ${drops.length} bırakma olamaz`);

  notlar.push(`tohum ${r.seed}`);
  notlar.push(`${drops.length} bırakma, ${r.events.length} olay`);
  notlar.push(`${sure.toFixed(1)} saniye (${r.steps} fizik adımı)`);
  notlar.push(`bildirilen skor ${r.score}, yapısal tavan ${tavan}`);
  notlar.push(`yetenek kullanımı: ${r.events.filter(e => e.t === 'b').length} ateşle, ` +
              `${r.events.filter(e => e.t === 'h').length} çekiç, ` +
              `${r.events.filter(e => e.t === 'm').length} ergit`);

  return { gecerli: hata.length === 0, hata, notlar, kayit: r };
}

/* ── SONRAKİ ADIM: tam tekrar ──────────────────────────────────────────────
   Skoru bağımsız hesaplamak için oyunun deterministik çekirdeğini ortak bir
   modüle çıkar:  cekirdek.js  →  { sabitler, dagitici, adim(durum, girdiler) }
   Hem pota.html hem bu betik onu kullansın. O zaman:

     const c = cekirdek.yeni(seed);
     for (let s = 0; s <= kayit.steps; s++) {
       kayit.events.filter(e => e.s === s).forEach(e => cekirdek.girdi(c, e));
       cekirdek.adim(c);
     }
     if (c.skor !== kayit.score) reddet();

   UYARI: Matter.js'in kayan nokta davranışı platformlar arasında bit-bit aynı
   olmayabilir. Sunucu istemciyle AYNI matter-js sürümünü çalıştırmalı ve küçük
   sapmalara tolerans tanımalı (ör. %0.5), yoksa dürüst oyuncuları reddedersin.
   ───────────────────────────────────────────────────────────────────────── */

if (require.main === module) {
  const arg = process.argv.slice(2);
  let girdi;
  if (arg[0] === '--dosya') girdi = require('fs').readFileSync(arg[1], 'utf8');
  else girdi = arg.join(' ');
  if (!girdi) { console.error('Kullanım: node dogrula.js "<tekrar>" | --dosya <yol>'); process.exit(2); }

  try {
    const r = verify(girdi);
    r.notlar.forEach(x => console.log('  · ' + x));
    console.log('');
    if (r.gecerli) { console.log('YAPISAL DENETİM: GEÇTİ'); console.log('(skor bağımsız hesaplanmadı — tam tekrar gerekir)'); }
    else { console.log('REDDEDİLDİ'); r.hata.forEach(h => console.log('  ! ' + h)); process.exit(1); }
  } catch (e) {
    console.log('REDDEDİLDİ');
    console.log('  ! ' + e.message);
    process.exit(1);
  }
}

module.exports = { verify, parse };
