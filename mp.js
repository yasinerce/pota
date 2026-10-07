/* POTA — yerel ağ çok oyunculu katmanı (WebRTC / PeerJS)
   ─────────────────────────────────────────────────────────────────────────
   MODEL: "ayna" — rakibin fiziği simüle EDİLMEZ. Kendi oyunun yerelde tam
   fizikle akar; karşıya yalnızca olaylar ve seyrek özetler gider:

     atk  {p}          saldırı puanı (birleşmeden)
     sum  {s,h,y,n}    özet: skor, ısı, yığın tepesi, cisim sayısı (2 Hz)
     ko   {}           pota taştı — gönderen kaybetti
     hi   {seed}       el sıkışma: ev sahibi tohumu dayatır (adil dağıtım)

   Bant genişliği ~1 KB/s. El sıkışma internet üzerinden (PeerJS bulutu),
   oyun verisi cihazdan cihaza — aynı ağda pratik olarak LAN trafiği.

   SALDIRI KURALLARI (tetr.io'nun iptal modeli):
   - Her birleşme (kademe+1) × zincir çarpanı kadar saldırı puanı üretir.
   - Puan önce GELEN kuyruğu siler (savunma), artan rakibe gider.
   - Gelen saldırı 3 sn kuyrukta bekler, sonra cüruf olarak düşer:
     her 10 puan = 1 cüruf, 25+ tek seferde = büyük cüruf.                */

(function(){
  'use strict';
  const MP={
    aktif:false, host:false, peer:null, conn:null,
    gelen:0,                    // bekleyen saldırı puanı (kuyruk)
    gelenT:0,                   // kuyruğun düşme zamanı
    rakip:{s:0,h:0,y:1,n:0,ad:'RAKİP'},
    sonuc:null,                 // 'win' | 'lose' | 'kopma'
    _sumT:0,
  };
  window.MP=MP;

  const KUYRUK_SURE=3000;       // saldırının havada asılı kaldığı süre
  const PUAN_CURUF=10;          // kaç puan = 1 cüruf
  const BUYUK_ESIK=25;          // tek pakette bu kadar puan = büyük cüruf

  function baglanti(c){
    MP.conn=c;
    c.on('data',d=>{
      try{
        if(d.t==='atk'){
          MP.gelen+=d.p;
          if(!MP.gelenT)MP.gelenT=performance.now()+KUYRUK_SURE;
        }
        else if(d.t==='sum')MP.rakip={...MP.rakip,...d};
        else if(d.t==='ko'){MP.sonuc='win';}
        else if(d.t==='hi'&&!MP.host&&window.mpBaslat)window.mpBaslat(d.seed);
      }catch(e){}
    });
    c.on('close',()=>{if(!MP.sonuc)MP.sonuc='kopma';});
    c.on('error',()=>{if(!MP.sonuc)MP.sonuc='kopma';});
  }

  MP.kur=function(kod,cb){        // ev sahibi
    MP.host=true;
    MP.peer=new Peer('pota-'+kod,{debug:0});
    MP.peer.on('open',()=>cb&&cb(null));
    MP.peer.on('error',e=>cb&&cb(e));
    MP.peer.on('connection',c=>{
      baglanti(c);
      c.on('open',()=>{
        MP.aktif=true;
        const seed=Math.floor(Math.random()*1679616).toString(36).toUpperCase().padStart(4,'0');
        c.send({t:'hi',seed});
        window.mpBaslat&&window.mpBaslat(seed);
      });
    });
  };

  MP.katil=function(kod,cb){      // misafir
    MP.host=false;
    MP.peer=new Peer({debug:0});
    MP.peer.on('error',e=>cb&&cb(e));
    MP.peer.on('open',()=>{
      const c=MP.peer.connect('pota-'+kod,{reliable:true});
      c.on('open',()=>{MP.aktif=true;baglanti(c);cb&&cb(null);});
      c.on('error',e=>cb&&cb(e));
    });
  };

  MP.gonder=function(o){try{MP.conn&&MP.conn.open&&MP.conn.send(o);}catch(e){}};

  /* Oyundan çağrılır: birleşme saldırı puanı üretti.
     Önce gelen kuyruğu iptal eder, artan rakibe gider. */
  MP.saldiri=function(p){
    if(!MP.aktif)return;
    if(MP.gelen>0){
      const sil=Math.min(MP.gelen,p);
      MP.gelen-=sil;p-=sil;
      if(MP.gelen<=0){MP.gelen=0;MP.gelenT=0;}
    }
    if(p>0)MP.gonder({t:'atk',p});
  };

  /* Her karede oyun döngüsünden çağrılır.
     Dönen değer: bu karede düşmesi gereken cüruf listesi [{buyuk:bool},...] */
  MP.adim=function(now,ozet){
    if(!MP.aktif)return [];
    if(now-MP._sumT>500){MP._sumT=now;MP.gonder({t:'sum',...ozet});}
    if(MP.gelen>0&&MP.gelenT&&now>=MP.gelenT){
      const paket=MP.gelen;MP.gelen=0;MP.gelenT=0;
      const adet=Math.max(1,Math.floor(paket/PUAN_CURUF));
      const out=[];
      for(let i=0;i<adet;i++)out.push({buyuk:paket>=BUYUK_ESIK&&i===0});
      return out;
    }
    return [];
  };

  MP.ko=function(){if(MP.aktif&&!MP.sonuc){MP.gonder({t:'ko'});MP.sonuc='lose';}};

  MP.kapat=function(){
    try{MP.conn&&MP.conn.close();}catch(e){}
    try{MP.peer&&MP.peer.destroy();}catch(e){}
    MP.aktif=false;MP.host=false;MP.conn=null;MP.peer=null;
    MP.gelen=0;MP.gelenT=0;MP.sonuc=null;
    MP.rakip={s:0,h:0,y:1,n:0,ad:'RAKİP'};
  };
})();
