/* POTA — önyükleme teşhisi
   game.js'ten ÖNCE yüklenir. Amacı: game.js çalışmazsa bunu görünür kılmak.
   (Önceki sürümde hata yakalayıcı game.js'in içindeydi — dosya hiç çalışmazsa
   yakalayıcı da çalışmıyordu.)

   Ekranın altındaki yazı üç durumu ayırır:
     YÜKLENİYOR…   -> hiçbir script çalışmadı (CSP engelliyor ya da dosya yok)
     ÖNYÜKLEME OK  -> boot.js çalıştı ama game.js çalışmadı
     SÜRÜM 1.0.1   -> her şey yolunda                                        */
(function () {
  var v = null;
  function ver(t) {
    v = v || document.querySelector('.ver');
    if (v) v.textContent = t;
  }
  function goster(baslik, detay) {
    try {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;' +
        'background:#3A0F0F;color:#FFD9D9;font:11px/1.5 monospace;padding:10px;' +
        'white-space:pre-wrap;max-height:50%;overflow:auto';
      d.textContent = baslik + '\n' + detay;
      (document.body || document.documentElement).appendChild(d);
    } catch (e) {}
  }

  // game.js'in ayrıştırma hatalarını da yakalar, çünkü ondan önce kuruluyor
  window.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'SCRIPT') {
      goster('SCRIPT YÜKLENEMEDİ', (e.target.src || '?') +
        '\n\nDosya sunucuda yok (404) ya da CSP engelledi.');
      return;
    }
    goster('JAVASCRIPT HATASI',
      (e.message || e.type) + '\n' + (e.filename || '?') + ' satir ' + (e.lineno || '?'));
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    goster('PROMISE REDDEDİLDİ', String(e.reason && e.reason.message || e.reason));
  });

  ver('ÖNYÜKLEME OK · game.js bekleniyor');

  // 2 saniye içinde game.js kendini bildirmezse sebebini araştır
  setTimeout(function () {
    if (window.__POTA_YUKLENDI) return;
    fetch('game.js', { cache: 'no-store' })
      .then(function (y) {
        if (!y.ok) goster('game.js BULUNAMADI', 'HTTP ' + y.status +
          '\n\nDosyayı depoya yüklemeyi unutmuş olabilirsin.' +
          '\nindex.html ile game.js AYNI klasörde olmalı.');
        else goster('game.js indirildi ama ÇALIŞMADI',
          'Dosya sunucuda var (HTTP 200) ama kod yürütülmedi.' +
          '\nMuhtemel sebep: CSP engeli veya sözdizimi hatası.' +
          '\nÜstteki kırmızı kutuda ayrıntı varsa oraya bak.');
      })
      .catch(function (h) {
        goster('game.js DENETLENEMEDİ', String(h) +
          '\n\nAğ hatası ya da CSP connect-src engeli.');
      });
  }, 2000);
})();
