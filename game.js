/* Önyükleme teşhisi boot.js'e taşındı — game.js hiç çalışmazsa buradaki
   yakalayıcı da çalışmıyordu. Burada sadece "yüklendim" bildirimi kalıyor. */
window.__POTA_YUKLENDI=true;
(function(){
  function isaret(){
    var v=document.querySelector('.ver');
    if(v)v.textContent='SÜRÜM 1.0.1';
  }
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',isaret);
  else isaret();
  if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
    window.addEventListener('load',function(){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    });
  }
})();

if(typeof Matter==='undefined'){
  document.body.innerHTML='<div style="font:12px monospace;color:#E8E0D0;padding:40px;'+
    'text-align:center;letter-spacing:.1em">FİZİK MOTORU YÜKLENEMEDİ<br><br>'+
    '<span style="color:#8A8272">matter.js dosyasına ulaşılamıyor.<br>'+
    'Bağlantınızı kontrol edin veya kütüphaneyi yerelden yükleyin.</span></div>';
  throw new Error('Matter.js yuklenemedi');
}
const {Engine,World,Bodies,Body,Composite,Events,Vector,Sleeping}=Matter;
const VERSION='1.0.0';

/* ═══ KALICI DEPOLAMA ══════════════════════════════════════════════════
   Varsayılan adaptör BELLEK İÇİdir: depolamanın engellendiği ortamlarda
   (gömülü önizlemeler, katı gizlilik ayarları) hatasız çalışır, ama sayfa
   yenilenince sıfırlanır.

   YAYINA ÇIKARKEN aşağıdakilerden birini açın.

   ── Tarayıcı / basit web dağıtımı ──────────────────────────────────
   const Store={
     get:k=>{try{return localStorage.getItem('pota.'+k)}catch(e){return null}},
     set:(k,v)=>{try{localStorage.setItem('pota.'+k,v)}catch(e){}}
   };

   ── Capacitor (ÖNERİLEN) ───────────────────────────────────────────
   localStorage'a güvenmeyin: WebView onu habersiz temizleyebilir.
   npm i @capacitor/preferences
   import {Preferences} from '@capacitor/preferences';
   const cache={};
   export async function hydrate(){                 // açılışta bir kez çağırın
     const {value}=await Preferences.get({key:'pota.state'});
     Object.assign(cache,value?JSON.parse(value):{});
   }
   const Store={
     get:k=>cache[k]??null,
     set:(k,v)=>{cache[k]=v;Preferences.set({key:'pota.state',value:JSON.stringify(cache)});}
   };
   ═══════════════════════════════════════════════════════════════════ */
const Store=(()=>{const mem={};return{get:k=>mem[k]??null,set:(k,v)=>{mem[k]=v}};})();
const bestKey=()=>'best_'+mode;
const loadBest=()=>{const v=Store.get(bestKey());return v?parseInt(v,10)||0:0;};
const saveBest=v=>Store.set(bestKey(),String(v));
const FIXED=1000/60;          // fizik her zaman 60 Hz'te koşar
/* Dönme sönümü neredeyse kapalı. 0.72 iken toplar birbirine yapışmış gibi
   iniyordu — yuvarlanma bu türde bir kusur değil, akıcılığın kaynağı.
   Sönümü kısmamıza gerek yok: "hep sola kayma" yuvarlanmadan değil,
   çokgen köşelerinin aynı hizada doğmasından geliyordu ve o rastgele
   başlangıç açısıyla çözüldü. Buradaki tek iş, sonsuza dek süren mikro
   dönmeyi kesmek. */
const ANG_DAMP=.995;          // 1 = tamamen serbest yuvarlanma
const ANG_MIN=.002;           // bunun altındaki dönme sıfırlanır
let acc=0;
const wake=b=>{if(b.isSleeping)Sleeping.set(b,false);};
const wakeAll=()=>{for(const b of Composite.allBodies(engine.world))if(!b.isStatic)wake(b);};

/* Matter.js'te YUVARLANMA DİRENCİ yok. Daire zemine değince sürtünme ona tork
   uygular, dönmeye başlar, ama dönmeyi kesecek hiçbir kuvvet yoktur — sürtünme
   tam tersine yuvarlanmayı korur. Kayan nokta yuvarlamasından doğan minicik bir
   asimetri bu yüzden sonsuza kadar süren, hep aynı yöne giden bir kaymaya döner.
   Aşağıdaki iki mekanizma o boşluğu kapatıyor. Her fizik adımından sonra çalışır. */
/* 0.93 fazla sertti: toplar bıraktığın yere çakılıyor, yığın kendi kendine
   oturmuyordu. Oysa yuvarlanma bu türde bir ÖZELLİK — toplar boşluklara kayıp
   yerleşir, çökme hissi oradan gelir. Kaymayı önleyecek kadar, oturmayı
   engellemeyecek kadar.                                                     */
/* SADE FİZİK — sıfırdan kuruldu.
   Önceki sürümde altı ayrı müdahale vardı: yuvarlanma sönümü, oturma
   kelepçesi, hız tavanı, sınır bekçisi, kademeli yoğunluk/zıplama/sürtünme.
   Hiçbiri ölçülmemişti ve birbirleriyle çakışıyorlardı.

   Yeni ilke: Matter.js'in çözücüsüne karışma. Malzeme değerlerini ayarla,
   gerisini motora bırak. Tek istisna, oyunun çökmesini engelleyen güvenlik
   ağıdır (havada donmuş cisim) — o da yalnızca patolojik durumda devreye
   girer, normal fizikte hiç çalışmaz.                                     */


/* ══════════ AYARLAR ══════════ */
const W=400,H=760,TOP=138,LINE_Y=182,FLOOR_Y=660,WALL_T=40;
const BASE_INSET=46,MAX_INSET=82,NARROW_STEP=1800,NARROW_AMT=9;
const DROP_CD=360,COMBO_WINDOW=2600,OVER_GRACE=1800;
const SLAG_FIRST=14,SLAG_EVERY=11,SLAG_WARN=900,SLAG_R=19;
const SLAG_LIFE=20000,SLAG_MERGE_DMG=.34,SLAG_MERGE_RANGE=145;
const HEAT_DECAY=0.0032;

const TIERS=[
  /* Palet ham renk kodlarına göre DEĞİL, gölgelendirmeden geçmiş ekran
     çıktısına göre optimize edildi. Ham ölçüm yanıltıcıydı: çevre yansıması
     farkları eziyordu (ör. Kurşun/Platin ham ΔE 52.6 iken ekranda 17.6).
     Renk körlüğü simülasyonu da hesaba katıldı. */
  {n:'Kum',           s:'Si', r:14, c:'#A39A5C', rough:.95, metal:0},
  {n:'Cevher',        s:'Or', r:18, c:'#8E80CD', rough:.82, metal:.25},
  {n:'Kurşun',        s:'Pb', r:23, c:'#2F4F65', rough:.58, metal:1},
  {n:'Bakır',         s:'Cu', r:29, c:'#BD633D', rough:.34, metal:1},
  {n:'Bronz',         s:'Bz', r:35, c:'#673B00', rough:.46, metal:1},
  {n:'Kobalt',        s:'Co', r:42, c:'#215DCB', rough:.30, metal:1},
  {n:'Demir',         s:'Fe', r:50, c:'#889294', rough:.42, metal:1},
  {n:'Gümüş',         s:'Ag', r:59, c:'#E4EAEA', rough:.11, metal:1},
  {n:'Altın',         s:'Au', r:69, c:'#EBA400', rough:.17, metal:1},
  {n:'Platin',        s:'Pt', r:80, c:'#4DD6B8', rough:.09, metal:1},
  {n:'Yıldız çeliği', s:'★',  r:92, c:'#00EBFF', rough:.05, metal:1},
];
const MAXT=TIERS.length-1,SPAWNABLE=5;
const COST={burn:30,ham:50,melt:75};

/* ══════════ DURUM ══════════ */
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
let engine,wallL,wallR,floorB;
let score=0,best=0,combo=0,maxCombo=0,comboAt=-9e9,heat=0,peak=-1,merges=0;
let queue=[0,1,2],dropX=W/2,dropReady=true,dropCount=0;
let inset=BASE_INSET,targetInset=BASE_INSET;
let overSince=0,gameOver=false,paused=true,started=false,armed=null,slagWarn=0,slagX=W/2;
let narrowLv=0;

/* ═══ TEKRAR KAYDI ═══════════════════════════════════════════════════════
   Oyun deterministik (tohumlu RNG + sabit zaman adımı). Bu sayede skoru
   göndermek yerine GİRDİ DİZİSİNİ gönderebiliriz; sunucu aynı tohumla
   yeniden oynatıp skoru kendisi hesaplar. Hile yapmak için oyunu gerçekten
   iyi oynamak gerekir.

   Kayıt fizik ADIM sayacına göre tutulur, duvar saatine göre değil —
   determinizmin şartı budur.                                              */
let physStep=0,log=[];
const LOG_MAX=6000;
function rec(type,x,y){
  if(log.length>=LOG_MAX)return;
  log.push(y===undefined?[physStep,type,Math.round(x*10)/10]
                        :[physStep,type,Math.round(x*10)/10,Math.round(y*10)/10]);
}
function replayString(){
  return 'POTA1|'+seedCode+'|'+physStep+'|'+score+'|'+
    log.map(e=>e.join(',')).join(';');
}
let shakeMag=0,pops=[],sparks=[],floats=[],embers=[],poolT=0;
let dust=[],debris=[],blooms=[],flash=0,zoom=1,shownScore=0,scorePunch=0,multPunch=0;
let ending=0,lastThud=0,lastBeat=0,lastCombo=0;
let debug=false,fps=60,fpsAcc=0,fpsN=0;

/* ═══ KAYMA ÖLÇÜMÜ ════════════════════════════════════════════════════════
   "Toplar sola kayıyor" şikâyeti üç kez tahminle çözülmeye çalışıldı,
   üçü de tutmadı. Artık ölçüyoruz.

   T tuşu: potayı boşaltır, tam merkeze (x=200.000) bir top bırakır, durana
   kadar bekler ve merkeze göre sapmayı yazar. 20 kez tekrarlar.

   Yorumlama:
     |sapma| < 1 px, işaret karışık -> kayma yok, sorun algıdadır (çizim/
                                        dokunma eşlemesi)
     sapma tutarlı NEGATİF            -> gerçek sol kayma, kaynağı çözücü
     sapma büyük ve rastgele          -> yığın kararsızlığı, kayma değil     */
let dt_aktif=false,dt_body=null,dt_bekle=0,dt_sonuc=[],dt_n=0;
function driftTest(){
  if(!engine)return;
  dt_aktif=true;dt_sonuc=[];dt_n=0;
  for(const b of Composite.allBodies(engine.world))
    if(!b.isStatic)Composite.remove(engine.world,b);
  dt_at();
}
function dt_at(){
  dt_body=orb(W/2,LINE_Y+40,0);          // en küçük kademe, tam merkez
  Body.setVelocity(dt_body,{x:0,y:0});   // sıfır başlangıç hızı
  Body.setAngularVelocity(dt_body,0);
  dt_bekle=0;
}
function dt_adim(){
  if(!dt_aktif||!dt_body)return;
  dt_bekle++;
  const v=Math.hypot(dt_body.velocity.x,dt_body.velocity.y);
  if((v<.02&&dt_bekle>30)||dt_bekle>400){
    dt_sonuc.push(dt_body.position.x-W/2);
    Composite.remove(engine.world,dt_body);dt_body=null;
    if(++dt_n>=20){
      dt_aktif=false;
      const ort=dt_sonuc.reduce((a,b)=>a+b,0)/dt_sonuc.length;
      const sol=dt_sonuc.filter(x=>x<-.05).length;
      const sag=dt_sonuc.filter(x=>x>.05).length;
      console.log('KAYMA ÖLÇÜMÜ',dt_sonuc.map(x=>x.toFixed(3)));
      toast('SAPMA '+ort.toFixed(2)+'px  S'+sol+'/G'+sag);
      dt_ozet='ort '+ort.toFixed(3)+'px   sol '+sol+'  sag '+sag+'  ('+dt_sonuc.length+' deneme)';
    }else dt_at();
  }
}
let dt_ozet='T = kayma olcumu';
const mergeQ=[];

/* ══════════ SES ══════════ */
let AC=null,sound=true;
const ac=()=>{
  if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();
  if(AC.state==='suspended')AC.resume();   // iOS bağlamı askıda başlatır
  return AC;
};
function beep(f,d,type='triangle',v=.14){
  if(!sound)return;
  try{const a=ac(),o=a.createOscillator(),g=a.createGain();
    o.type=type;o.frequency.setValueAtTime(f,a.currentTime);
    o.frequency.exponentialRampToValueAtTime(f*.78,a.currentTime+d);
    g.gain.setValueAtTime(v,a.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);
    o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+d);}catch(e){}
}
function noise(d=.16,v=.11,freq=900){
  if(!sound)return;
  try{const a=ac(),n=a.sampleRate*d,buf=a.createBuffer(1,n,a.sampleRate),ch=buf.getChannelData(0);
    for(let i=0;i<n;i++)ch[i]=(Math.random()*2-1)*(1-i/n);
    const s=a.createBufferSource();s.buffer=buf;
    const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=freq;
    const g=a.createGain();g.gain.value=v;
    s.connect(f);f.connect(g);g.connect(a.destination);s.start();}catch(e){}
}
const buzz=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};

/* ══════════ KÜRE PİŞİRME ═══════════════════════════════════════════════
   Toplar 11 sabit boyutta ve hiç değişmiyor. O yüzden her kareyi yeniden
   boyamak yerine, her kademe BİR KEZ piksel piksel gölgelendiriliyor.
   Çalışma anında geriye iki drawImage kalıyor — eski degrade yığınından da
   hızlı, ama karşılığında istediğimiz kadar pahalı bir model kurabiliyoruz.

   Model:
   · Çevre yansıması  — metalin rengi yoktur, çevreyi yansıtır. Küre normalinden
                        yansıyan ışın hesaplanıp dikey çevre haritasından okunuyor
                        (üstte karanlık tavan, altta erimiş havuz).
   · Pürüzlülük       — yansımayı bulanıklaştırır, speküları genişletir.
   · Fresnel          — sıyırma açısında her yüzey aynaya döner, kenar parlar.
   · Spekülar         — ocağın ağzından gelen ana ışık.
   · Yüzey dokusu     — döküm gözenekleri ve çizikler, ayrı katmanda (dönebilsin).
   · Temas gölgesi    — cisimleri sahneye oturtan şey.                        */

/* Sprite'ı sabit bir çarpanla pişirmek yanlıştı. Ekrandan DÜŞÜK pişirmek
   bulanıklık, YÜKSEK pişirmek boşa iş + küçültme kırpması demek. Doğrusu tam
   cihaz pikseli oranında pişirmek: hem en yüksek gerçek çözünürlük, hem 1:1
   blit olduğu için en hızlısı.                                              */
let SS=2, bakedSS=0;
const DPR_MAX=4;
/* Bazı WebView'lar devicePixelRatio'yu 1 bildiriyor (viewport ölçeklendiğinde),
   oysa ekran fiziksel olarak 3x. Bu yüzden ALT SINIR koyuyoruz: her koşulda en
   az 2x çiziyoruz. Fazlası da zarar değil — küçültme süper-örnekleme sayılır. */
function renderScale(){
  return Math.min(DPR_MAX,Math.max(2,devicePixelRatio||1));
}
// Yatay ve dikey ölçek ayrışırsa küçüğünü al, yoksa bir eksende bulanıklaşır
function targetSS(){return Math.max(1,Math.min(DPR_MAX,Math.min(cv.width/W,cv.height/H)));}
let sprLit=[],sprTex=[],sprShadow=null;
const hex2rgb=h=>{const v=parseInt(h.slice(1),16);return[v>>16,(v>>8)&255,v&255];};
const cl255=v=>v<0?0:v>255?255:v|0;

// Dikey çevre haritası: -1 tam yukarı (tavan), +1 tam aşağı (havuz)
function buildEnv(){
  const lut=new Uint8Array(256*3);
  const mix3=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  for(let i=0;i<256;i++){
    const y=i/255*2-1;let c;
    if(y<-.12)      c=mix3([14,16,23],[40,45,60],(y+1)/.88);      // karanlık tavan
    else if(y<.38)  c=mix3([40,45,60],[104,62,32],(y+.12)/.50);   // tuğla duvar
    else            c=mix3([104,62,32],[255,176,84],(y-.38)/.62); // erimiş havuz
    lut[i*3]=c[0];lut[i*3+1]=c[1];lut[i*3+2]=c[2];
  }
  return lut;
}

function bakeLit(tier,ENV){
  const T=TIERS[tier],R=Math.round(T.r*SS),S=R*2;
  const cvs=document.createElement('canvas');cvs.width=cvs.height=S;
  const g=cvs.getContext('2d'),img=g.createImageData(S,S),d=img.data;
  const [br,bg,bb]=hex2rgb(T.c),metal=T.metal;
  /* Ayna kademeleri (Platin .09, Yıldız .05) neredeyse yalnızca çevreyi
     yansıtıyor ve kendi renklerini kaybediyordu. Taban pürüzlülük bunu keser. */
  const rough=Math.max(.30,T.rough);
  const shin=4+(1-rough)*(1-rough)*150;
  const Lx=-.42,Ly=-.60,Lz=.68;                       // ana ışık: ocağın ağzı
  const hl=Math.hypot(Lx,Ly,Lz+1);
  const hx=Lx/hl,hy=Ly/hl,hz=(Lz+1)/hl;               // yarı vektör
  for(let py=0;py<S;py++)for(let px=0;px<S;px++){
    const u=(px+.5-R)/R,v=(py+.5-R)/R,d2=u*u+v*v,i=(py*S+px)*4;
    if(d2>1){d[i+3]=0;continue;}
    const nz=Math.sqrt(1-d2),nx=u,ny=v;

    // yansıyan ışının dikey bileşeni; pürüzlülük yansımayı ufka çeker
    const ry=2*nz*ny*(1-rough*.72);
    const e=(cl255((ry+1)*.5*255))*3;
    let R0=ENV[e],G0=ENV[e+1],B0=ENV[e+2];
    const tr=metal?br/255:.6+.4*br/255,
          tg=metal?bg/255:.6+.4*bg/255,
          tb=metal?bb/255:.6+.4*bb/255;
    R0*=tr;G0*=tg;B0*=tb;

    // dielektrikte dağınık aydınlanma
    const ndl=Math.max(0,nx*Lx+ny*Ly+nz*Lz);
    const dif=(1-metal)*(.20+.80*ndl),k=metal?1:.38;
    let cr=R0*k+br*dif,cg=G0*k+bg*dif,cb=B0*k+bb*dif;

    /* OKUNABİLİRLİK TAVİZİ: fizikte metalin dağınık yansıması yoktur, sadece
       çevreyi yansıtır. Ama ocağın turuncu ortamı tüm metalleri birbirine
       benzetiyordu (ölçüldü: bazı çiftler ΔE 5'e kadar düşüyordu). Metalin
       kendi rengi %72 oranında kendini gösteriyor. Gerçekçilikten ödün,
       ayırt edilebilirlikten kazanç. */
    if(metal){
      const ALB=.72,lum=.30+.70*ndl;
      cr=cr*(1-ALB)+br*lum*ALB;cg=cg*(1-ALB)+bg*lum*ALB;cb=cb*(1-ALB)+bb*lum*ALB;
    }

    // Fresnel — beyaza boğmasın diye metalde azaltıldı
    const F=Math.pow(1-nz,4.2),fr=metal?.22:.80;
    cr+=(255-cr)*F*fr;cg+=(255-cg)*F*fr;cb+=(255-cb)*F*fr;

    // spekülar
    const sp=Math.pow(Math.max(0,nx*hx+ny*hy+nz*hz),shin)*(1-rough*.55)*150;
    cr+=sp*(metal?.6+br/255*.4:1);
    cg+=sp*(metal?.6+bg/255*.4:1);
    cb+=sp*(metal?.6+bb/255*.4:1);

    const dist=(1-Math.sqrt(d2))*R;                   // 1px kenar yumuşatma
    d[i]=cl255(cr);d[i+1]=cl255(cg);d[i+2]=cl255(cb);
    d[i+3]=dist>=1?255:dist<=0?0:(dist*255)|0;
  }
  g.putImageData(img,0,0);
  return cvs;
}

// Yüzey dokusu ayrı katmanda: top dönerken bu da dönsün, ışık dönmesin.
function bakeTex(tier){
  const T=TIERS[tier],R=Math.round(T.r*SS),S=R*2;
  const cvs=document.createElement('canvas');cvs.width=cvs.height=S;
  const g=cvs.getContext('2d');
  g.save();g.beginPath();g.arc(R,R,R,0,7);g.clip();
  const pits=Math.round(R*R*.0055*(.35+T.rough));
  for(let i=0;i<pits;i++){                            // döküm gözenekleri
    const a=Math.random()*6.283,rr=Math.sqrt(Math.random())*R*.97;
    g.fillStyle=Math.random()<.62?`rgba(0,0,0,${.10+Math.random()*.22})`
                                 :`rgba(255,255,255,${.05+Math.random()*.12})`;
    g.beginPath();g.arc(R+Math.cos(a)*rr,R+Math.sin(a)*rr,(.4+Math.random()*1.5)*SS,0,7);g.fill();
  }
  const scr=Math.round(4+T.rough*11);
  for(let i=0;i<scr;i++){                             // çizikler
    const a=Math.random()*6.283,rr=Math.sqrt(Math.random())*R*.9;
    const px=R+Math.cos(a)*rr,py=R+Math.sin(a)*rr;
    const len=3+Math.random()*R*.42,ang=Math.random()*6.283;
    g.strokeStyle=`rgba(255,255,255,${.04+Math.random()*.09})`;
    g.lineWidth=Math.max(1,SS*.6);
    g.beginPath();g.moveTo(px,py);g.lineTo(px+Math.cos(ang)*len,py+Math.sin(ang)*len);g.stroke();
  }
  if(T.r>=20){                                        // döküm damgası — küçüklerde de
    g.textAlign='center';
    g.font=`700 ${Math.round(R*.44)}px "Big Shoulders Display",sans-serif`;
    g.fillStyle='rgba(255,255,255,.15)';g.fillText(T.s,R,R+R*.16+SS);
    g.fillStyle='rgba(0,0,0,.34)';g.fillText(T.s,R,R+R*.16);
  }
  const fade=g.createRadialGradient(R,R,R*.5,R,R,R); // kenara doğru sönsün
  fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(1,'rgba(0,0,0,1)');
  g.globalCompositeOperation='destination-out';
  g.fillStyle=fade;g.fillRect(0,0,S,S);
  g.restore();
  return cvs;
}

function bakeShadow(){
  const S=128,cvs=document.createElement('canvas');cvs.width=cvs.height=S;
  const g=cvs.getContext('2d');
  const rg=g.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
  rg.addColorStop(0,'rgba(0,0,0,.6)');rg.addColorStop(.45,'rgba(0,0,0,.26)');
  rg.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=rg;g.fillRect(0,0,S,S);return cvs;
}

/* Hepsini birden pişirmek telefonda ~yarım saniye donma demek. Oysa oyun
   yalnızca ilk 5 kademeyle başlıyor ve onlar küçük olduğu için ucuz. Kalanlar
   kareler arasına yayılıyor; oyuncu Kobalt'a ulaşana kadar çoktan hazır olur. */
let bakeQueue=[],ENVLUT=null;
function bakeSpheres(){
  bakedSS=SS;bakeQueue.length=0;
  ENVLUT=buildEnv();
  sprShadow=bakeShadow();
  for(let t=0;t<SPAWNABLE;t++){sprLit[t]=bakeLit(t,ENVLUT);sprTex[t]=bakeTex(t);}
  for(let t=SPAWNABLE;t<TIERS.length;t++)bakeQueue.push(t);   // arka planda
}
function bakeStep(){
  if(!bakeQueue.length||!ENVLUT)return;
  const t=bakeQueue.shift();
  sprLit[t]=bakeLit(t,ENVLUT);sprTex[t]=bakeTex(t);
}

/* ══════════ DOKU ÖNBELLEĞİ ══════════ */
let brickTex=null,grainTex=null,panelTex=null;
/* Tuğla duvar eskiden 400x760 mantıksal boyutta pişirilip 3 katına esnetiliyordu
   — bulanıklığın asıl kaynağı buydu. Şimdi cihaz çözünürlüğünde ve yalnızca
   gerçekten görünen üst bantta pişiyor (altını pota zaten örtüyor).           */
const BRICK_H=TOP+24;
function buildTextures(){
  const bw=Math.round(W*SS),bh=Math.round(BRICK_H*SS);
  const b=document.createElement('canvas');b.width=bw;b.height=bh;
  const g=b.getContext('2d');g.scale(SS,SS);
  g.fillStyle='#1A1512';g.fillRect(0,0,W,BRICK_H);
  const brw=76,brh=30;
  for(let row=0,y=-10;y<BRICK_H;row++,y+=brh){
    const off=(row%2)*brw/2;
    for(let x=-brw;x<W+brw;x+=brw){
      const v=Math.random()*14-7;
      g.fillStyle=`rgb(${58+v},${44+v},${36+v})`;
      g.fillRect(x+off+1.5,y+1.5,brw-3,brh-3);
      g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x+off+1.5,y+brh-5,brw-3,3.5);
    }
  }
  g.fillStyle='rgba(10,8,7,.55)';g.fillRect(0,0,W,BRICK_H);
  brickTex=b;

  // ── POTA PANELİ ────────────────────────────────────────────────────────
  // Daralma sırasında her karede yeniden pişirmemek için panel EN GENİŞ halde
  // bir kez pişiriliyor; iç kenarı sabit referans, panel sadece kaydırılıyor.
  const PW=MAX_INSET, pw=Math.round(PW*SS), ph=Math.round((H-TOP+40)*SS);
  const pc=document.createElement('canvas');pc.width=pw;pc.height=ph;
  const q=pc.getContext('2d');q.scale(SS,SS);q.translate(0,-(TOP-20));
  const E=PW;                                  // panelin iç kenarı
  q.fillStyle='#15181E';q.fillRect(-PW,TOP-20,PW*2,H);
  q.fillStyle='#3A2C24';q.fillRect(E-7,TOP-20,7,H);          // refrakter astar
  const bg2=q.createLinearGradient(E-23,0,E-7,0);            // demir bant
  bg2.addColorStop(0,'#333944');bg2.addColorStop(.55,'#242932');bg2.addColorStop(1,'#171A20');
  q.fillStyle=bg2;q.fillRect(E-23,TOP-20,16,H);
  for(let y=TOP+4;y<H;y+=46){                                // perçinler
    q.beginPath();q.arc(E-15,y,2.6,0,7);q.fillStyle='#5A6270';q.fill();
    q.beginPath();q.arc(E-15.7,y-.8,1.3,0,7);q.fillStyle='#8B93A2';q.fill();
  }
  panelTex=pc;

  // ── FİLM GRENİ ─────────────────────────────────────────────────────────
  // 128'lik döşeme kare başına ~24 çizim yapıyordu; 256'da 6'ya iniyor.
  const NS=256,nc=document.createElement('canvas');nc.width=nc.height=NS;
  const ng=nc.getContext('2d'),id=ng.createImageData(NS,NS);
  for(let i=0;i<id.data.length;i+=4){
    const v=200+Math.random()*55;
    id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255;
  }
  ng.putImageData(id,0,0);grainTex=nc;
}

/* ══════════ KURULUM ══════════ */
/* Kullanılabilir alana sığan EN BÜYÜK 400x760 dikdörtgeni hesaplar.
   Oran kesin korunur, dolayısıyla yatay ve dikey ölçek daima eşit olur. */
const wrapEl=document.getElementById('wrap');
function layout(){
  const cs=getComputedStyle(document.body);
  const pw=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0);
  const ph=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0);
  const aw=document.documentElement.clientWidth-pw;
  const ah=(window.visualViewport?window.visualViewport.height:window.innerHeight)-ph;
  const sc=Math.min(aw/W,ah/H);
  wrapEl.style.width=(W*sc)+'px';
  wrapEl.style.height=(H*sc)+'px';
}

function fit(){
  layout();
  const dpr=renderScale(),r=cv.getBoundingClientRect();
  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
  if(w===cv.width&&h===cv.height)return;
  cv.width=w;cv.height=h;
  const ns=targetSS();
  if(!bakedSS||Math.abs(ns-bakedSS)/bakedSS>.12){   // ölçek anlamlı değiştiyse
    SS=ns;buildTextures();bakeSpheres();
  }
}
addEventListener('resize',fit);
addEventListener('orientationchange',()=>setTimeout(fit,120));
if(window.visualViewport)visualViewport.addEventListener('resize',fit);

function makeWalls(){
  const o={isStatic:true,friction:.06,restitution:.02,slop:.05};   // duvarlar da yapışmasın
  wallL=Bodies.rectangle(inset-WALL_T/2,H/2,WALL_T,H*1.8,o);
  wallR=Bodies.rectangle(W-inset+WALL_T/2,H/2,WALL_T,H*1.8,o);
  floorB=Bodies.rectangle(W/2,FLOOR_Y+WALL_T/2,W*2,WALL_T,o);
  World.add(engine.world,[wallL,wallR,floorB]);
}
const moveWalls=()=>{
  Body.setPosition(wallL,{x:inset-WALL_T/2,y:H/2});
  Body.setPosition(wallR,{x:W-inset+WALL_T/2,y:H/2});
  wakeAll();                               // uyuyan cisim duvarın içinde kalmasın
};

function reset(){
  if(engine)Engine.clear(engine);
  engine=Engine.create();
  engine.gravity.y=1.18;                   // ağırlık hissi (varsayılan 1)
  engine.positionIterations=6;engine.velocityIterations=4;engine.constraintIterations=2;  // Matter varsayılanları
  // UYKU KİPİ AÇILMAMALI. Matter'da uyuyan cisme yerçekimi uygulanmaz ve ancak
  // bir çarpışma onu uyandırır. Bu oyunda altındaki toplar birleşerek yok oluyor;
  // destek kaybolduğunda çarpışma olayı doğmadığı için üstteki top havada asılı
  // kalıyordu. Uyku kipi bu oyunun mekaniğiyle bağdaşmaz, açılmamalı.
  engine.enableSleeping=false;
  acc=0;
  score=0;combo=0;maxCombo=0;heat=0;peak=-1;merges=0;dropCount=0;
  inset=targetInset=BASE_INSET;
  overSince=0;gameOver=false;armed=null;slagWarn=0;shakeMag=0;narrowLv=0;
  pops=[];sparks=[];floats=[];dust=[];debris=[];blooms=[];mergeQ.length=0;
  physStep=0;log=[];
  shownScore=0;scorePunch=0;multPunch=0;flash=0;zoom=1;ending=0;lastCombo=0;
  newSeed();bag=[];last2=[-1,-1];best=loadBest();
  queue=[rnd(),rnd(),rnd()];
  makeWalls();
  Events.on(engine,'collisionStart',onHit);

  over.classList.remove('show');pausedEl.classList.remove('show');
  paused=false;started=true;
  syncTools();
}
/* ─── Adil dağıtım ────────────────────────────────────────────────
   1. Tohumlu RNG   → aynı tohum, aynı sıra. Runlar karşılaştırılabilir.
   2. Ağırlıklı torba → her kademenin potaya soktuğu TOPLAM ALAN ≈ eşit.
   3. Çift adet      → her 24 dökümde her kademe çift sayıda; öksüz taş yok.
   4. Seri kırıcı    → üç aynı taş asla arka arkaya gelmez.               */

function hashStr(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
function mulberry32(a){
  return function(){
    a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296;
  };
}
let mode='daily',seedCode='',rand=Math.random;
function newSeed(){
  if(mode==='daily'){
    const d=new Date();
    seedCode=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  }else{
    seedCode=Math.floor(Math.random()*1679616).toString(36).toUpperCase().padStart(4,'0');
  }
  rand=mulberry32(hashStr('POTA-'+seedCode));
}

const BAG=[5,3,2,1,1];                  // Kum, Cevher, Kurşun, Bakır, Bronz
const BAG_SZ=BAG.reduce((a,b)=>a+b,0);  // 12 — iki torba = [10,6,4,2,2]
let bag=[],last2=[-1,-1];

// Torbayı sırayla kurar: her adımda kalan adetlere göre ağırlıklı seçer ve
// üçüncü kez üst üste gelecek kademeyi eler. Son taşlar da kurala tabi olduğu
// için "torba sonunda seri kalması" mümkün değil.
function refillBag(){
  for(let attempt=0;attempt<40;attempt++){
    const left=BAG.slice(),out=[];
    let p1=last2[1],p2=last2[0],ok=true;
    for(let k=0;k<BAG_SZ;k++){
      const w=[];let total=0;
      for(let t=0;t<left.length;t++){
        const v=(t===p1&&t===p2)?0:left[t];   // üçlü seri yasak
        w.push(v);total+=v;
      }
      if(total===0){ok=false;break;}          // çıkmaz sokak → baştan kur
      let r=rand()*total,pick=0;
      while(r>=w[pick]){r-=w[pick];pick++;}
      out.push(pick);left[pick]--;p2=p1;p1=pick;
    }
    if(ok){bag=out;return;}
  }
  bag=[];                                     // güvenlik ağı
  for(let t=0;t<BAG.length;t++)for(let i=0;i<BAG[t];i++)bag.push(t);
}
/* ─── Öksüz taş ertelemesi ────────────────────────────────────────────────
   Sorun: Bronz (yarıçap 35) sahada eşi yokken düşünce potanın üçte birini
   kaplayan ölü bir kütle oluyordu. Eşi ortalama 12 döküm sonra geliyor.

   Denenen ve ELENEN çözüm: eşleri torbada birbirine yaklaştırmak. Ölçüldü,
   işe yaramadı — eşler kümelenince aralar uzuyor, ortalama frekans dağılımla
   zaten sabit olduğu için toplam bekleme değişmiyor.

   Uygulanan çözüm: taş sahada karşılığı yoksa TORBADA ERTELENİR, atılmaz.
   Sırada karşılığı olan bir taş varsa o öne alınır. Torbanın bileşimi
   değişmez — sadece sıra kayar, yani dağılım garantilerinin hepsi durur.
   Ertelenen taş, sahada eşi oluştuğunda kendiliğinden gelir.

   YAN ETKİ: sıra artık sahaya da bağlı, yalnızca tohuma değil. Bağımsız
   dağıtıcı denetimi (tools/dogrulama) bu yüzden kademe kontrolünü yapamaz;
   tam tekrar doğrulaması hâlâ geçerli.                                     */
const DEFER_FROM=2;              // bu kademeden itibaren erteleme uygulanır

function onBoard(tier){
  if(!engine)return false;
  for(const b of Composite.allBodies(engine.world)){
    if(b.isStatic||!b.plugin)continue;
    if(b.plugin.tier===tier)return true;
  }
  return false;
}
function playable(tier){
  return tier<DEFER_FROM||onBoard(tier)||queue.includes(tier);
}
function rnd(){
  if(!bag.length)refillBag();
  let i=0;
  if(!playable(bag[0])){
    // sırada oynanabilir bir taş var mı? varsa öne al, diğerini torbada bırak
    for(let j=1;j<bag.length;j++)if(playable(bag[j])){i=j;break;}
  }
  const piece=bag.splice(i,1)[0];
  last2=[last2[1],piece];
  return piece;
}

/* ══════════ CİSİMLER ══════════ */
function orb(x,y,tier){
  const t=TIERS[tier];
  const b=Bodies.circle(x,y,t.r,{
    /* AĞIRLIK ve YAPIŞKANLIK ayrı parametrelerdir, karıştırılmamalı:

       YAPIŞKANLIK = sürtünme.  Sıfırlandı.
         frictionStatic 0  -> cisimler temas anında birbirine KİLİTLENMEZ.
                              Yapışma hissinin tek kaynağı buydu.
         friction .08      -> yalnızca dönüşü başlatacak kadar; sürtünme
                              tamamen sıfır olsaydı toplar dönmeden kayardı.

       AĞIRLIK = sekme + düşüş + yerçekimi.  Aşağıdaki üçlü ve gravity=1.18.
         restitution .03   -> zıplamaz, küt oturur ("tok")
         frictionAir .007  -> havada oyalanmaz, kararlı hızlanır
         density  .001     -> kütle alandan gelir                          */
    restitution:.03,
    friction:.08,
    frictionStatic:0,
    /* frictionAir varsayılanı .01. Hafifçe artırıldı: sabit adımda tam
       yükseklikten düşen küçük top ~28 piksel/adım hıza ulaşıyor ve kendi
       çapını aşıyor — teorik tünelleme riski. .018 bunu ~25'e çekiyor.
       Testte iç içe geçme görürsen .03 dene. */
    frictionAir:.007,
    density:.001,           // TÜM kademelerde aynı — kütle farkı alandan gelir
    slop:.05                // varsayılan
  });

  b.plugin={tier,pulse:1,spin:Math.random()*6,sq:0,sqA:0};
  /* HEP SOLA KAYMANIN SEBEBİ:
     Matter.js'te Bodies.circle gerçek daire değil, çokgen yaklaşımıdır —
     kenar sayısı min(25, yarıçap). Kum (r=14) aslında 14 kenarlı bir çokgen.
     Tüm cisimler angle=0 ile doğduğu için her topun köşe dizilimi birebir
     aynıydı: zemine hep aynı yüzeyle iniyor ve hep aynı tarafa deviriliyordu.
     Rastgele değil, deterministik bir yanlılık.
     Rastgele başlangıç açısı bu hizalanmayı bozar. Sönümleme veya hız
     müdahalesi gerekmez — kaynak buydu. */
  Body.setAngle(b,rand()*Math.PI*2);
  World.add(engine.world,b);return b;
}
function pickSlagX(){
  const cols=7,pad=34,span=W-2*inset-2*pad;
  let bx=W/2,by=-1;
  for(let i=0;i<cols;i++){
    const x=inset+pad+span*(i/(cols-1));
    let top=FLOOR_Y;
    for(const b of Composite.allBodies(engine.world)){
      if(b.isStatic||!b.plugin)continue;
      const r=b.plugin.tier<0?SLAG_R:TIERS[b.plugin.tier].r;
      if(Math.abs(b.position.x-x)<r+16)top=Math.min(top,b.position.y-r);
    }
    if(top>by){by=top;bx=x;}                 // en alçak yığının üstüne bırak
  }
  return bx;
}
function slag(x){
  const b=Bodies.polygon(x,30,7,SLAG_R,{restitution:.03,friction:.14,frictionStatic:.02,frictionAir:.008,density:.0016,slop:.05,chamfer:{radius:3}});
  b.plugin={tier:-1,pulse:1,sq:0,sqA:0,life:SLAG_LIFE,maxLife:SLAG_LIFE};
  Body.setAngularVelocity(b,(rand()-.5)*.2);
  World.add(engine.world,b);
  noise(.24,.14,520);buzz(30);
}
function burnOff(b){
  const{x,y}=b.position;
  pops.push({x,y,r:SLAG_R,t:0,c:'#FF8A2B'});
  if(!reduce)for(let i=0;i<12;i++)
    sparks.push({x,y,vx:(Math.random()-.5)*6,vy:-Math.random()*5-.5,l:1,c:'#FFC46B'});
  if(!reduce)for(let i=0;i<6;i++)debris.push({
    x,y,vx:(Math.random()-.5)*4,vy:-Math.random()*4-1,
    rot:Math.random()*6,vr:(Math.random()-.5)*.3,l:1,s:3+Math.random()*4});
  blooms.push({x,y,r:SLAG_R,t:.25});
  Composite.remove(engine.world,b);
  noise(.18,.09,1600);
}
function impactFX(b,p){
  if(b.isStatic||!b.plugin)return;
  const sp=b.speed;
  if(sp<2.2)return;
  const r=b.plugin.tier<0?SLAG_R:TIERS[b.plugin.tier].r;
  const now=performance.now();
  if(sp>3.4&&!reduce&&dust.length<110){
    const c=(p.collision.supports&&p.collision.supports[0])||b.position;
    const k=Math.min(8,2+(sp|0));
    for(let i=0;i<k;i++)dust.push({
      x:c.x+(Math.random()-.5)*r*.5,y:c.y,
      vx:(Math.random()-.5)*3.4,vy:-Math.random()*1.9-.2,
      l:1,r:.8+Math.random()*2.1});
  }
  if(sp>4.2&&now-lastThud>55){
    lastThud=now;
    beep(44+1300/r,.075,'sine',Math.min(.13,sp*.012));
    noise(.05,Math.min(.05,sp*.005),260);
    // sarsıntı momentumla ölçülür: ağır külçe ocağı sarsar, kum tanesi sarsmaz
    shakeMag=Math.max(shakeMag,Math.min(3.4,sp*.12*(r/58)));
    // metal metale çarpınca kıvılcım çıkar; ezilmez
    if(sp>6&&!reduce){
      const c=(p.collision.supports&&p.collision.supports[0])||b.position;
      const k=Math.min(6,(sp-5)|0);
      for(let i=0;i<k;i++)sparks.push({
        x:c.x,y:c.y,vx:(Math.random()-.5)*4.5,vy:-Math.random()*3.5-.4,
        l:.8,c:'#FFCE8A'});
    }
  }
}
function onHit(ev){
  for(const p of ev.pairs){
    const a=p.bodyA,b=p.bodyB;
    impactFX(a,p);impactFX(b,p);
    if(!a.plugin||!b.plugin)continue;
    a.plugin.settled=b.plugin.settled=true;
    if(a.plugin.dead||b.plugin.dead)continue;
    if(a.plugin.tier<0||b.plugin.tier<0)continue;
    if(a.plugin.tier!==b.plugin.tier||a.plugin.tier>=MAXT)continue;
    a.plugin.dead=b.plugin.dead=true;
    mergeQ.push({a,b,kalan:MERGE_DELAY});
  }
}
/* Birleşme artık anlık değil: temas anında birleşme göz tarafından
   yakalanamıyordu. MERGE_DELAY fizik adımı süren bir "kaynama" evresi var —
   çift birbirine çekilir ve parlar, SONRA birleşir. Süre fizik adımıyla
   sayılır (determinizm), duvar saatiyle değil.                            */
const MERGE_DELAY=7;                      // ~115ms @60Hz
function flush(){
  for(let qi2=mergeQ.length-1;qi2>=0;qi2--){
    const m2=mergeQ[qi2];
    if(--m2.kalan>0){
      // Kuvvet UYGULANMIYOR: çekim kuvveti çözücünün ayırma kuvvetiyle
      // çakışıyor ve titreme üretiyordu. Bekleme artık tamamen görsel.
      m2.a.plugin.fusing=m2.b.plugin.fusing=1-m2.kalan/MERGE_DELAY;
      continue;
    }
    mergeQ.splice(qi2,1);
    const a=m2.a,b=m2.b;
    const tier=a.plugin.tier;
    /* Yeni külçe, ORTA NOKTADA değil YERDEKİ külçenin yerinde doğar.
       Orta nokta kuleyi kaydırıyor ve oyuncu nereye büyüyeceğini kestiremiyordu.
       Alttaki (y'si büyük olan) kazanır; aynı hizadaysalar yavaş olan kazanır.
       Ayrıca yarıçap farkı kadar YUKARI kaydırılır, böylece külçenin tabanı
       yerinde kalır, aşağıya doğru zemine gömülmez — kule yukarı büyür. */
    const g=(Math.abs(a.position.y-b.position.y)<4)
      ? (a.speed<=b.speed?a:b)
      : (a.position.y>b.position.y?a:b);
    const x=g.position.x,
          y=g.position.y-(TIERS[tier+1].r-TIERS[tier].r);
    Composite.remove(engine.world,a);Composite.remove(engine.world,b);
    const nb=orb(x,y,tier+1);
    // yeni metal, eriyen ikisinin hızını devralır — yerinde donup kalmaz
    Body.setVelocity(nb,{x:g.velocity.x*.5,y:g.velocity.y*.5});  // yerdekinin hızı
    // fiziksel şok dalgası: komşuları dışarı iter
    const rad=TIERS[tier+1].r*1.9;
    for(const o of Composite.allBodies(engine.world)){
      if(o.isStatic||o===nb||!o.plugin)continue;
      const d=Vector.sub(o.position,{x,y}),dist=Vector.magnitude(d)||1;
      if(dist<rad){
        wake(o);                           // applyForce uyuyan cismi uyandırmaz
        const f=(1-dist/rad)*.00007*(tier+2)*o.mass;   // yalnızca yer açar
        Body.applyForce(o,o.position,{x:d.x/dist*f,y:d.y/dist*f});
      }
    }
    blooms.push({x,y,r:TIERS[tier+1].r,t:0});   // yerel ısı parlaması

    const now=performance.now();
    combo=(now-comboAt<COMBO_WINDOW)?combo+1:1;
    comboAt=now;maxCombo=Math.max(maxCombo,combo);merges++;
    const m=mult(),gain=Math.round((tier+1)*10*m);
    score+=gain;scorePunch=1;
    if(window.MP&&MP.aktif)MP.saldiri(Math.round((tier+1)*mult()));
    /* Eskiden 4+kademe*1.5 idi: geç oyunda üç birleştirme Ergit'e yetiyor,
       yetenekler ilerledikçe UCUZLUYORDU. Eğim düşürüldü.                   */
    heat=Math.min(100,heat+3.5+tier*.65);
    if(heat>=COST.burn)tip('heat','Isı doldu — alttaki yetenekleri kullanabilirsin');
    if(combo>=2)tip('combo','Hızlı birleştirmeler çarpanı yükseltir');
    peak=Math.max(peak,tier+1);

    pops.push({x,y,r:TIERS[tier+1].r,t:0,c:TIERS[tier+1].c});
    floats.push({x,y,txt:'+'+gain,t:0,c:combo>1?'#FFB86B':'#E8E0D0'});
    if(!reduce)for(let i=0;i<9+tier*2;i++)
      sparks.push({x,y,vx:(Math.random()-.5)*7.5,vy:-Math.random()*6.5-1,l:1,
        c:Math.random()<.5?'#FFD9A0':TIERS[tier+1].c});

    beep(180+tier*46,.14+tier*.01);
    buzz(tier>=5?26:12);
    if(tier>=5)shakeMag=Math.max(shakeMag,Math.min(4.5,1.5+tier*.35));
    if(combo>=3)toast('×'+combo+' ZİNCİR');
    if(tier+1===MAXT){toast('YILDIZ ÇELİĞİ');shakeMag=8;beep(880,.55,'sine',.18);}

    // yakındaki cürufu çatlat — iyi oyun potayı temizler
    for(const o of Composite.allBodies(engine.world)){
      if(o.isStatic||!o.plugin||o.plugin.tier>=0)continue;
      const d=Vector.magnitude(Vector.sub(o.position,{x,y}));
      if(d<SLAG_MERGE_RANGE+TIERS[tier+1].r)
        o.plugin.life-=o.plugin.maxLife*SLAG_MERGE_DMG;
    }
    /* Daralma eskiden 0.05 lerp ile sessizce kayıyordu — oyuncu fark etmiyor,
       sadece işlerin zorlaştığını hissediyordu. Algılanamayan zorluk haksızlıktır.
       Artık duyurulan bir olay.                                              */
    const lv=Math.floor(score/NARROW_STEP);
    if(lv>narrowLv&&BASE_INSET+lv*NARROW_AMT<=MAX_INSET){
      narrowLv=lv;
      toast('POTA DARALDI');
      shakeMag=Math.max(shakeMag,11);
      noise(.45,.16,200);buzz([30,60,30]);
    }
    targetInset=Math.min(MAX_INSET,BASE_INSET+lv*NARROW_AMT);
  }
}
const mult=()=>(performance.now()-comboAt>COMBO_WINDOW)?1:Math.min(3,1+(combo-1)*.18);

/* ══════════ GİRDİ ══════════ */
function pt(e){
  const r=cv.getBoundingClientRect();
  return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};
}
const clampX=x=>{const r=TIERS[queue[0]].r;return Math.max(inset+r+2,Math.min(W-inset-r-2,x));};
let dragging=false;
cv.addEventListener('pointerdown',e=>{
  if(gameOver||paused||!started)return;
  ac();const p=pt(e);
  if(armed==='burn'){burnAt(p);return;}
  dragging=true;dropX=clampX(p.x);
});
cv.addEventListener('pointermove',e=>{if(dragging)dropX=clampX(pt(e).x);});
addEventListener('pointerup',()=>{if(dragging){dragging=false;drop();}});
addEventListener('pointercancel',()=>dragging=false);
// mobil tarayıcı jestlerini kapat: uzun basma menüsü, çift dokunuş yakınlaştırma, kaydırma
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('dblclick',e=>e.preventDefault());
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
addEventListener('keydown',e=>{
  if(gameOver||paused||!started)return;
  if(e.key==='ArrowLeft')dropX=clampX(dropX-16);
  else if(e.key==='ArrowRight')dropX=clampX(dropX+16);
  else if(e.key===' '){e.preventDefault();drop();}
});
function drop(){
  if(!dropReady||gameOver||paused)return;
  dropReady=false;setTimeout(()=>dropReady=true,DROP_CD);
  rec('d',dropX);
  const t=queue[0],b=orb(dropX,LINE_Y-TIERS[t].r-8,t);
  Body.setVelocity(b,{x:0,y:6});
  queue.shift();queue.push(rnd());
  beep(120,.07,'square',.07);
  if(dropCount===2)tip('drop','Aynı iki metal çarpışırsa birleşir');
  dropCount++;
  if(dropCount>=SLAG_FIRST&&(dropCount-SLAG_FIRST)%SLAG_EVERY===0){
    slagWarn=performance.now();slagX=pickSlagX();toast('CÜRUF GELİYOR');
    tip('slag','Cüruf birleşmez ama yanarak erir — yakınında birleştir');
  }
}

/* ══════════ YETENEKLER ══════════ */
const bBurn=document.getElementById('t-burn'),bHam=document.getElementById('t-ham'),bMelt=document.getElementById('t-melt');
bBurn.onclick=()=>{if(heat<COST.burn||gameOver)return;armed=armed==='burn'?null:'burn';syncTools();};
bHam.onclick=()=>{
  if(heat<COST.ham||gameOver)return;
  rec('h',0);heat-=COST.ham;armed=null;
  // savrulan çiftler sahada birbirine uçmasın: kaynamaları iptal et
  for(const m of mergeQ){m.a.plugin.dead=m.b.plugin.dead=false;m.a.plugin.fusing=m.b.plugin.fusing=0;}
  mergeQ.length=0;
  wakeAll();
  for(const b of Composite.allBodies(engine.world)){
    if(b.isStatic)continue;
    Body.setVelocity(b,{x:(rand()-.5)*9,y:-4-rand()*3});
    Body.setAngularVelocity(b,(rand()-.5)*.35);
  }
  shakeMag=12;noise(.32,.16,380);buzz([20,40,20]);toast('ÇEKİÇ');syncTools();
};
bMelt.onclick=()=>{
  if(heat<COST.melt||gameOver)return;
  const map={};
  for(const b of Composite.allBodies(engine.world)){
    if(b.isStatic||b.plugin.tier<0||b.plugin.tier>=MAXT||b.plugin.dead)continue;
    (map[b.plugin.tier]=map[b.plugin.tier]||[]).push(b);
  }
  let pick=-1,n=0;
  for(const k in map)if(map[k].length>=2&&map[k].length>n){n=map[k].length;pick=+k;}
  if(pick<0){toast('EŞLEŞME YOK');return;}
  rec('m',0);heat-=COST.melt;armed=null;
  const l=map[pick];
  // en yakın komşu eşleme: uzak çiftlerin birbirine sürüklenmesini önler
  const kalanlar=[...l];
  while(kalanlar.length>=2){
    const a=kalanlar.shift();
    let bi=0,bd=1e9;
    for(let i=0;i<kalanlar.length;i++){
      const d=Vector.magnitude(Vector.sub(kalanlar[i].position,a.position));
      if(d<bd){bd=d;bi=i;}
    }
    const b=kalanlar.splice(bi,1)[0];
    a.plugin.dead=b.plugin.dead=true;
    // yakınsa kaynasınlar, uzaksa bekletmeden birleştir
    mergeQ.push({a,b,kalan:bd<(TIERS[pick].r*3)?MERGE_DELAY:1});
  }
  comboAt=performance.now();shakeMag=9;toast('ERGİT');syncTools();
};
function burnAt(p){
  for(const b of Composite.allBodies(engine.world)){
    if(b.isStatic)continue;
    const isSlag=b.plugin.tier<0;
    const r=(isSlag?SLAG_R:TIERS[b.plugin.tier].r)+9;   // parmak payı
    if(Vector.magnitude(Vector.sub(b.position,p))<r){
      pops.push({x:b.position.x,y:b.position.y,r,t:0,c:'#FF8A2B'});
      if(!reduce)for(let i=0;i<16;i++)
        sparks.push({x:b.position.x,y:b.position.y,vx:(Math.random()-.5)*9,vy:-Math.random()*7,l:1,c:'#FFC46B'});
      rec('b',p.x,p.y);
      // silinen cisim bir kaynama çiftindeyse çifti iptal et, eşini serbest bırak
      for(let i=mergeQ.length-1;i>=0;i--){
        const m=mergeQ[i];
        if(m.a===b||m.b===b){
          const es=m.a===b?m.b:m.a;
          es.plugin.dead=false;es.plugin.fusing=0;
          mergeQ.splice(i,1);
        }
      }
      Composite.remove(engine.world,b);
      heat-=isSlag?COST.burn/2:COST.burn;      // cürufu temizlemek ucuz
      armed=null;
      noise(.22,.13,1400);buzz(24);toast(isSlag?'CÜRUF ATILDI':'BUHAR');syncTools();return;
    }
  }
  armed=null;syncTools();
}

/* ══════════ HUD (HTML kısmı) ══════════ */
const over=document.getElementById('over'),pausedEl=document.getElementById('paused'),
      startEl=document.getElementById('start');
function syncTools(){
  const set=(el,c)=>{el.disabled=heat<c;el.classList.toggle('ready',heat>=c);};
  set(bBurn,COST.burn);set(bHam,COST.ham);set(bMelt,COST.melt);
  bBurn.classList.toggle('armed',armed==='burn');
}
let toastMsg='',toastT=-9e9;
const toast=m=>{toastMsg=m;toastT=performance.now();};

/* İlk oyun ipuçları. Dört mekanik var ve hiçbiri kendini anlatmıyordu:
   oyuncu ısının ne olduğunu, cürufun neden geldiğini nereden bilecek?
   Her ipucu ömür boyu bir kez, tetiklendiği anda, oyunu durdurmadan. */
let tipMsg='',tipT=-9e9,tipsSeen={};
function tip(key,msg){
  if(tipsSeen[key]||Store.get('tip_'+key))return;
  tipsSeen[key]=1;Store.set('tip_'+key,'1');
  tipMsg=msg;tipT=performance.now();
}
document.getElementById('i-snd').onclick=function(){sound=!sound;this.classList.toggle('on',sound);};
document.getElementById('i-dbg').onclick=function(){debug=!debug;this.classList.toggle('on',debug);};
addEventListener('keydown',e=>{
  if(e.key==='d'||e.key==='D'){debug=!debug;document.getElementById('i-dbg').classList.toggle('on',debug);}
  if(e.key==='t'||e.key==='T'){debug=true;driftTest();}
});
document.getElementById('i-pause').onclick=()=>{
  if(started&&!gameOver){
    paused=true;
    document.getElementById('p-confirm').style.display='none';
    pausedEl.classList.add('show');
  }
};
document.getElementById('resume').onclick=()=>{
  paused=false;pausedEl.classList.remove('show');
  document.getElementById('p-confirm').style.display='none';
};
/* Yeniden başlat: skoru silen bir eylem yanlış dokunuşla tetiklenmemeli,
   o yüzden tek onay adımı var. Onay, perde her açıldığında sıfırlanır. */
document.getElementById('p-restart').onclick=()=>{
  document.getElementById('p-confirm').style.display='block';
};
document.getElementById('p-yes').onclick=()=>{
  document.getElementById('p-confirm').style.display='none';
  pausedEl.classList.remove('show');
  reset();
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started&&!gameOver){paused=true;pausedEl.classList.add('show');}});
const mDaily=document.getElementById('m-daily'),mFree=document.getElementById('m-free'),
      seedLine=document.getElementById('seedline');
function setMode(m){
  mode=m;
  mDaily.classList.toggle('on',m==='daily');
  mFree.classList.toggle('on',m==='free');
  newSeed();
  const bv=loadBest();
  // innerHTML yerine textContent: ileride oyuncu adı gibi dış veri buraya
  // gelirse enjeksiyon kapısı açılmasın diye şimdiden kapatıldı.
  seedLine.textContent='Tohum '+seedCode+
    (m==='daily'?'  ·  bugün herkes aynı sırayı oynuyor':'')+
    (bv?'  ·  rekorun '+bv:'');
}
mDaily.onclick=()=>setMode('daily');
mFree.onclick=()=>setMode('free');
setMode('daily');
document.getElementById('begin').onclick=()=>{ac();startEl.classList.remove('show');reset();};

/* ═══ ÇOK OYUNCULU BAĞLAMA ═══════════════════════════════════════════════
   Ev sahibi 4 haneli kod üretir, misafir girer. Bağlantı kurulunca ev sahibi
   tohumu dayatır — iki taraf da AYNI taş sırasını alır, fark yalnızca oyuncu
   kararlarından doğar. Öksüz-erteleme sahaya baktığı için sıralar zamanla
   ayrışabilir; bu kabul edilmiş bir tavizdir (fizik zaten ayrışıyor, model
   ayna — determinizm değil adalet hedefleniyor).                          */
const mpLine=document.getElementById('mp-line');
function mpDurum(t){mpLine.style.display='block';mpLine.textContent=t;}
window.mpBaslat=function(seed){
  ac();
  mode='free';newSeed();          // newSeed'i çağırıp sonra tohumu eziyoruz:
  seedCode=seed;rand=mulberry32(hashStr('POTA-'+seed));
  bag=[];last2=[-1,-1];
  startEl.classList.remove('show');
  reset2();                        // tohumu koruyan reset
};
function reset2(){const s=seedCode,r=rand;reset();seedCode=s;rand=r;bag=[];last2=[-1,-1];queue=[rnd(),rnd(),rnd()];}
document.getElementById('mp-host').onclick=function(){
  if(typeof Peer==='undefined'){mpDurum('PeerJS yüklenemedi — internet gerekli');return;}
  const kod=Math.floor(1000+Math.random()*9000).toString();
  mpDurum('Kod: '+kod+' — rakip bekleniyor…');
  MP.kur(kod,e=>{if(e)mpDurum('Bağlantı hatası: '+(e.type||e));});
};
document.getElementById('mp-join').onclick=function(){
  if(typeof Peer==='undefined'){mpDurum('PeerJS yüklenemedi — internet gerekli');return;}
  const kod=prompt('Düello kodu (4 hane):');
  if(!kod)return;
  mpDurum('Bağlanılıyor…');
  MP.katil(kod.trim(),e=>{if(e)mpDurum('Bulunamadı: '+(e.type||e));});
};
document.getElementById('again').onclick=reset;
document.getElementById('share').onclick=async function(){
  const txt=`POTA · ${mode==='daily'?'Günlük':'Serbest'} ${seedCode}\n`+
    `${score} puan · ${peak<0?'—':TIERS[peak].n} · en uzun zincir ×${maxCombo}`;
  try{
    if(navigator.share){await navigator.share({text:txt});return;}
    if(debug){await navigator.clipboard.writeText(replayString());
              this.textContent='Tekrar kopyalandı';
              setTimeout(()=>this.textContent='Paylaş',1600);return;}
    await navigator.clipboard.writeText(txt);
    this.textContent='Kopyalandı';
    setTimeout(()=>this.textContent='Paylaş',1600);
  }catch(e){}
};

/* ══════════ ÇİZİM YARDIMCILARI ══════════ */
function shade(hex,a){
  const n=parseInt(hex.slice(1),16),f=v=>Math.max(0,Math.min(255,v+a));
  return`rgb(${f(n>>16)},${f((n>>8)&255)},${f(n&255)})`;
}
function mix(c1,c2,t){
  const a=parseInt(c1.slice(1),16),b=parseInt(c2.slice(1),16);
  const r=v=>Math.round(v);
  return`rgb(${r((a>>16)+((b>>16)-(a>>16))*t)},${r(((a>>8)&255)+(((b>>8)&255)-((a>>8)&255))*t)},${r((a&255)+((b&255)-(a&255))*t)})`;
}

function drawCrucible(now){
  const iw=W-2*inset;                                     // iç genişlik
  // iç boşluk: sıcak karanlık
  const inner=ctx.createLinearGradient(0,TOP,0,FLOOR_Y);
  inner.addColorStop(0,'#0D0F14');
  inner.addColorStop(1,mix('#0D0F14','#2A1508',.55+heat/300));
  ctx.fillStyle=inner;ctx.fillRect(inset,TOP-20,iw,FLOOR_Y-TOP+20);

  // pişmiş panel: iç kenarı inset'e hizalanacak şekilde kaydırılır
  if(panelTex){
    const PW=MAX_INSET,pt=TOP-20,phh=H-TOP+40;
    ctx.drawImage(panelTex,inset-PW,pt,PW,phh);
    ctx.save();ctx.translate(W,0);ctx.scale(-1,1);
    ctx.drawImage(panelTex,inset-PW,pt,PW,phh);ctx.restore();
  }

  // erimiş havuz
  poolT+=.03;
  const ph=20+heat*.12;
  const pg=ctx.createLinearGradient(0,FLOOR_Y-ph,0,FLOOR_Y);
  pg.addColorStop(0,mix('#5A1F06','#FFCB6B',heat/130));
  pg.addColorStop(1,mix('#2E1104','#FF7A18',heat/150));
  ctx.beginPath();ctx.moveTo(inset,FLOOR_Y);
  for(let x=inset;x<=W-inset;x+=8){
    ctx.lineTo(x,FLOOR_Y-ph+Math.sin(x*.05+poolT)*2.2+Math.sin(x*.13-poolT*1.7)*1.1);
  }
  ctx.lineTo(W-inset,FLOOR_Y);ctx.closePath();
  ctx.fillStyle=pg;ctx.fill();

  // havuzun yukarı vuran ışığı
  const glow=ctx.createLinearGradient(0,FLOOR_Y-190,0,FLOOR_Y-ph);
  glow.addColorStop(0,'rgba(255,107,18,0)');
  glow.addColorStop(1,`rgba(255,122,24,${.06+heat/100*.26})`);
  ctx.fillStyle=glow;ctx.fillRect(inset,FLOOR_Y-190,iw,190-ph);

  // taban plakası
  ctx.fillStyle='#101319';ctx.fillRect(0,FLOOR_Y,W,H-FLOOR_Y);
  ctx.fillStyle='#1D2129';ctx.fillRect(0,FLOOR_Y,W,5);

  // taşma hattı — zincir çizgi + iki mandal
  const dg=overSince?(now-overSince)/OVER_GRACE:0;
  const col=dg?`rgba(255,74,40,${.45+dg*.55})`:'rgba(201,162,39,.42)';
  ctx.strokeStyle=col;ctx.lineWidth=1;ctx.setLineDash([2,6]);
  ctx.beginPath();ctx.moveTo(inset,LINE_Y);ctx.lineTo(W-inset,LINE_Y);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle=col;
  ctx.fillRect(inset,LINE_Y-4,9,8);ctx.fillRect(W-inset-9,LINE_Y-4,9,8);
}

function drawGauge(now){
  // sağ raya kaynaklı pirinç termometre
  const gx=W-inset/2, y0=TOP+70, y1=FLOOR_Y-70, gh=y1-y0, gw=15;
  ctx.fillStyle='#191C22';ctx.fillRect(gx-gw/2-3,y0-9,gw+6,gh+18);
  ctx.strokeStyle='#6B5A22';ctx.lineWidth=1;
  ctx.strokeRect(gx-gw/2,y0,gw,gh);
  // sütun (aşağıdan yukarı dolar)
  const hh=gh*heat/100;
  if(hh>1){
    const cg=ctx.createLinearGradient(0,y1,0,y1-hh);
    cg.addColorStop(0,'#C9A227');cg.addColorStop(.6,'#FF6B12');cg.addColorStop(1,'#FFE2A8');
    ctx.fillStyle=cg;ctx.fillRect(gx-gw/2+2,y1-hh,gw-4,hh);
    ctx.shadowColor='#FF6B12';ctx.shadowBlur=heat/5;
    ctx.fillRect(gx-gw/2+2,y1-hh,gw-4,2);ctx.shadowBlur=0;
  }
  // yetenek eşikleri, kilit açılınca yanar
  ctx.font='600 10px "IBM Plex Mono",monospace';ctx.textAlign='center';
  [[30,'A'],[50,'Ç'],[75,'E']].forEach(([v,s])=>{
    const y=y1-gh*v/100, on=heat>=v;
    ctx.strokeStyle=on?'#FFD9A8':'#4A4436';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(gx-gw/2-4,y);ctx.lineTo(gx+gw/2+4,y);ctx.stroke();
    ctx.fillStyle=on?'#FFD9A8':'#4A4436';
    ctx.fillText(s,gx,y-4);
  });
  ctx.textAlign='left';
}

function drawLadder(){
  // sol raya: ulaşılan metal merdiveni
  const lx=inset/2, y1=FLOOR_Y-70, step=(y1-(TOP+70))/(MAXT);
  for(let i=0;i<=MAXT;i++){
    const y=y1-i*step, on=peak>=i, t=TIERS[i];
    ctx.beginPath();ctx.arc(lx,y,on?4.8:2.8,0,7);
    ctx.fillStyle=on?t.c:'#2A2E36';ctx.fill();
    if(i===peak){ctx.strokeStyle=t.c;ctx.globalAlpha=.5;ctx.lineWidth=1;
      ctx.beginPath();ctx.arc(lx,y,9.5,0,7);ctx.stroke();ctx.globalAlpha=1;}
  }
}

function drawHeader(now){
  // skor plakası
  ctx.fillStyle='#8A8272';ctx.font='600 10px "IBM Plex Mono",monospace';
  ctx.letterSpacing='2px';ctx.fillText('DÖKÜM',18,32);ctx.letterSpacing='0px';
  ctx.save();ctx.translate(17,74);
  const sc=1+scorePunch*.16;ctx.scale(sc,sc);
  ctx.fillStyle=scorePunch>.25?'#FFD9A8':'#E8E0D0';
  ctx.font='800 46px "Big Shoulders Display",sans-serif';
  ctx.fillText(Math.round(shownScore),0,0);ctx.restore();
  ctx.fillStyle='#8A8272';ctx.font='500 11px "IBM Plex Mono",monospace';
  ctx.fillText(peak<0?'—':TIERS[peak].n.toUpperCase(),18,94);

  // çarpan + kombo penceresi halkası
  const m=mult(),cx=W-58,cy=52,rr=19;
  const left=Math.max(0,1-(now-comboAt)/COMBO_WINDOW);
  ctx.strokeStyle='#2A2E36';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.arc(cx,cy,rr,0,7);ctx.stroke();
  if(left>0){
    ctx.strokeStyle=m>1?'#FF6B12':'#4A4436';ctx.lineWidth=2.5;ctx.lineCap='round';
    ctx.beginPath();ctx.arc(cx,cy,rr,-Math.PI/2,-Math.PI/2+left*Math.PI*2);ctx.stroke();
    ctx.lineCap='butt';
  }
  ctx.textAlign='center';
  ctx.fillStyle=m>1?'#FFB86B':'#5A5448';
  ctx.save();ctx.translate(cx,cy+7);
  const mc=1+multPunch*.3;ctx.scale(mc,mc);
  ctx.font='700 21px "Big Shoulders Display",sans-serif';
  ctx.fillText('×'+m.toFixed(1),0,0);ctx.restore();
  ctx.textAlign='left';

  // kalıp tepsisi: sıradaki iki metal
  const tx=W-116,ty=100;
  ctx.strokeStyle='#3D4450';ctx.lineWidth=1;ctx.strokeRect(tx,ty-13,58,26);
  ctx.fillStyle='#8A8272';ctx.font='500 9px "IBM Plex Mono",monospace';
  ctx.fillText('SIRADA',tx,ty-19);
  for(let i=1;i<3;i++){
    const t=TIERS[queue[i]];if(!t)continue;
    const qx=tx+16+(i-1)*26,r=i===1?8:6;
    ctx.globalAlpha=i===1?1:.45;
    const qs=sprLit[queue[i]];
    if(qs)ctx.drawImage(qs,qx-r,ty-r,r*2,r*2);
    else{ctx.beginPath();ctx.arc(qx,ty,r,0,7);ctx.fillStyle=t.c;ctx.fill();}
    ctx.globalAlpha=1;
  }
}

function metalFill(x,y,r,c){
  const g=ctx.createRadialGradient(x-r*.36,y-r*.4,r*.04,x,y,r*1.08);
  g.addColorStop(0,'#ffffff');g.addColorStop(.16,shade(c,52));
  g.addColorStop(.55,c);g.addColorStop(.88,shade(c,-40));
  g.addColorStop(1,shade(c,-62));
  return g;
}

function drawShadow(b){
  if(!sprShadow)return;
  const r=b.plugin.tier<0?SLAG_R:TIERS[b.plugin.tier].r;
  const sw=r*2.3,sh=r*.55;
  ctx.globalAlpha=.45;
  ctx.drawImage(sprShadow,b.position.x-sw/2,b.position.y+r-sh*.5,sw,sh);
  ctx.globalAlpha=1;
}

function drawOrb(b,now){
  const{x,y}=b.position,tier=b.plugin.tier,t=TIERS[tier],r=t.r;
  const lit=sprLit[tier],tex=sprTex[tier];
  if(!lit){                                    // pişirme bitmediyse yedek çizim
    ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fillStyle=t.c;ctx.fill();return;
  }
  const vy=b.velocity.y,sp=Math.hypot(b.velocity.x,vy);
  if(sp>11&&!reduce){                          // hareket bulanıklığı
    for(let i=1;i<=2;i++){
      ctx.globalAlpha=.10/i;
      ctx.drawImage(lit,x-b.velocity.x*i*1.3-r,y-vy*i*1.3-r,r*2,r*2);
    }
    ctx.globalAlpha=1;
  }

  const fus=b.plugin.fusing||0;
  if(fus){ctx.shadowColor='#FFB868';ctx.shadowBlur=8+fus*22;}
  else if(tier>=9){ctx.shadowColor=t.c;ctx.shadowBlur=20;}
  ctx.drawImage(lit,x-r,y-r,r*2,r*2);          // ışık katmanı: dönmez
  ctx.shadowBlur=0;
  if(fus){                                      // kaynama parlaması
    ctx.globalAlpha=fus*.45;
    ctx.fillStyle='#FFD9A0';
    ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();
    ctx.globalAlpha=1;
  }

  if(Math.abs(b.angle)>.002){                  // yüzey katmanı: döner
    ctx.save();ctx.translate(x,y);ctx.rotate(b.angle);
    ctx.drawImage(tex,-r,-r,r*2,r*2);ctx.restore();
  }else ctx.drawImage(tex,x-r,y-r,r*2,r*2);

  // havuzun anlık ışığı — ısı değiştiği için bu pişirilemez
  const prox=Math.max(0,Math.min(1,(y-LINE_Y)/(FLOOR_Y-LINE_Y)));
  const a=(.14+heat/100*.36)*prox;
  if(a>.01){
    ctx.strokeStyle=`rgba(255,122,24,${a})`;
    ctx.lineWidth=Math.max(1.4,r*.10);
    ctx.beginPath();ctx.arc(x,y,r-ctx.lineWidth/2,Math.PI*.16,Math.PI*.84);ctx.stroke();
  }
  if(armed==='burn'){
    ctx.save();ctx.translate(x,y);ctx.rotate(now*.0012);
    ctx.strokeStyle='rgba(255,138,43,.8)';ctx.lineWidth=2;ctx.setLineDash([5,5]);
    ctx.beginPath();ctx.arc(0,0,r+5,0,7);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }
}

function drawSlag(b){
  const{x,y}=b.position;
  const burn=1-Math.max(0,Math.min(1,b.plugin.life/b.plugin.maxLife)); // 0 soğuk → 1 yanmak üzere
  ctx.save();ctx.translate(x,y);
  ctx.beginPath();
  b.vertices.forEach((v,i)=>i?ctx.lineTo(v.x-x,v.y-y):ctx.moveTo(v.x-x,v.y-y));
  ctx.closePath();
  const g=ctx.createLinearGradient(0,-SLAG_R,0,SLAG_R);
  g.addColorStop(0,mix('#3A3532','#FF7A18',burn*.75));
  g.addColorStop(1,mix('#1E1B19','#B33A05',burn*.85));
  ctx.fillStyle=g;ctx.fill();
  if(burn>.5){ctx.shadowColor='#FF6B12';ctx.shadowBlur=(burn-.5)*30;}
  ctx.strokeStyle=mix('#524942','#FFCB6B',burn);ctx.lineWidth=1.5;ctx.stroke();
  ctx.shadowBlur=0;

  if(!b.plugin.spots){
    b.plugin.spots=[];
    for(let i=0;i<7;i++)b.plugin.spots.push([(Math.random()-.5)*24,(Math.random()-.5)*24]);
  }
  ctx.fillStyle=`rgba(255,150,50,${.2+burn*.7})`;
  for(const a of b.plugin.spots)ctx.fillRect(a[0],a[1],2,2);
  ctx.restore();
}

/* ══════════ ANA ÇİZİM ══════════ */
function draw(now){
  ctx.setTransform(cv.width/W,0,0,cv.height/H,0,0);
  ctx.clearRect(0,0,W,H);

  ctx.save();
  if(shakeMag>.2){ctx.translate((Math.random()-.5)*shakeMag,(Math.random()-.5)*shakeMag);shakeMag*=.86;}
  ctx.drawImage(brickTex,0,0,W,BRICK_H);               // tuğla arka plan

  drawCrucible(now);

  // ortam közleri
  if(!reduce){
    if(Math.random()<heat/240)embers.push({x:inset+Math.random()*(W-2*inset),y:FLOOR_Y-14,v:.35+Math.random()*.9,l:1});
    embers=embers.filter(e=>e.l>0);
    for(const e of embers){e.y-=e.v;e.l-=.005;e.x+=Math.sin(e.y*.05)*.3;
      ctx.fillStyle=`rgba(255,${140+Math.random()*60|0},60,${e.l*.55})`;ctx.fillRect(e.x,e.y,1.6,1.6);}
  }

  // cüruf uyarısı
  if(slagWarn&&now-slagWarn<SLAG_WARN){
    const k=(now-slagWarn)/SLAG_WARN;
    ctx.globalAlpha=.3+Math.sin(k*24)*.3;
    ctx.fillStyle='#524942';
    ctx.beginPath();ctx.moveTo(slagX,TOP+30);ctx.lineTo(slagX-14,TOP+4);ctx.lineTo(slagX+14,TOP+4);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle='#524942';ctx.lineWidth=1;ctx.setLineDash([3,5]);
    ctx.beginPath();ctx.moveTo(slagX,TOP+32);ctx.lineTo(slagX,FLOOR_Y);ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;
  }

  // kılavuz + elindeki metal
  if(!gameOver&&started){
    const t=TIERS[queue[0]],bob=Math.sin(now*.0035)*2.4,py=LINE_Y-t.r-8+bob;
    ctx.strokeStyle='rgba(232,224,208,.1)';ctx.lineWidth=1;ctx.setLineDash([1,5]);
    ctx.beginPath();ctx.moveTo(dropX,LINE_Y);ctx.lineTo(dropX,FLOOR_Y);ctx.stroke();ctx.setLineDash([]);
    ctx.globalAlpha=dropReady?1:.3;
    const ls=sprLit[queue[0]];
    if(ls){ctx.drawImage(ls,dropX-t.r,py-t.r,t.r*2,t.r*2);
           ctx.drawImage(sprTex[queue[0]],dropX-t.r,py-t.r,t.r*2,t.r*2);}
    else{ctx.beginPath();ctx.arc(dropX,py,t.r,0,7);ctx.fillStyle=t.c;ctx.fill();}
    ctx.globalAlpha=1;
  }

  // gölgeler önce, hepsi birden — yoksa sonraki top öncekinin gölgesini yer
  for(const b of Composite.allBodies(engine.world))if(!b.isStatic)drawShadow(b);
  for(const b of Composite.allBodies(engine.world)){
    if(b.isStatic)continue;
    if(b.plugin.tier<0)drawSlag(b);else drawOrb(b,now);
  }

  // efektler
  if(!reduce){
    // ısı bulutu — arcade halkası değil, sıcaklığın dışa vurumu
    blooms=blooms.filter(p=>p.t<1);
    for(const p of blooms){p.t+=.055;
      const rr=p.r*(1+p.t*1.5);
      const g=ctx.createRadialGradient(p.x,p.y,p.r*.2,p.x,p.y,rr);
      const a=(1-p.t)*(1-p.t)*.5;
      g.addColorStop(0,`rgba(255,232,190,${a})`);
      g.addColorStop(.5,`rgba(255,122,24,${a*.5})`);
      g.addColorStop(1,'rgba(255,90,10,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,rr,0,7);ctx.fill();}
    pops=pops.filter(p=>p.t<1);
    for(const p of pops){p.t+=.07;
      ctx.globalAlpha=(1-p.t)*.55;ctx.lineWidth=2*(1-p.t);ctx.strokeStyle=p.c;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r*(1+p.t*.85),0,7);ctx.stroke();ctx.globalAlpha=1;}
    sparks=sparks.filter(s=>s.l>0);
    for(const s of sparks){s.x+=s.vx;s.y+=s.vy;s.vy+=.32;s.vx*=.98;s.l-=.026;
      ctx.globalAlpha=Math.max(0,s.l);ctx.fillStyle=s.c;ctx.fillRect(s.x,s.y,2.2,2.2);ctx.globalAlpha=1;}
  }else{pops=[];sparks=[];blooms=[];}

  // toz bulutu
  if(!reduce){
    dust=dust.filter(d=>d.l>0);
    for(const d of dust){d.x+=d.vx;d.y+=d.vy;d.vy+=.09;d.vx*=.94;d.l-=.035;
      ctx.globalAlpha=Math.max(0,d.l)*.34;ctx.fillStyle='#C7B79C';
      ctx.beginPath();ctx.arc(d.x,d.y,d.r*(1+(1-d.l)*1.7),0,7);ctx.fill();}
    debris=debris.filter(d=>d.l>0);
    for(const d of debris){d.x+=d.vx;d.y+=d.vy;d.vy+=.34;d.rot+=d.vr;d.l-=.02;
      ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);
      ctx.globalAlpha=Math.max(0,d.l);ctx.fillStyle='#4A403A';
      ctx.fillRect(-d.s/2,-d.s/2,d.s,d.s);ctx.restore();}
    ctx.globalAlpha=1;
  }else{dust=[];debris=[];}

  floats=floats.filter(f=>f.t<1);
  ctx.textAlign='center';ctx.font='700 17px "Big Shoulders Display",sans-serif';
  for(const f of floats){f.t+=.022;
    ctx.globalAlpha=Math.max(0,1-f.t);ctx.fillStyle=f.c;
    ctx.fillText(f.txt,f.x,f.y-f.t*36);ctx.globalAlpha=1;}
  ctx.textAlign='left';

  ctx.restore();

  // sarsılmayan katman: makineye kaynaklı göstergeler
  drawGauge(now);drawLadder();drawHeader(now);
  if(window.MP&&MP.aktif)drawMP(now);

  // vinyet + gren
  const v=ctx.createRadialGradient(W/2,H*.52,H*.28,W/2,H*.52,H*.78);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.62)');
  ctx.fillStyle=v;ctx.fillRect(0,0,W,H);

  // taşma yaklaşıyor: kırmızı nabız
  if(overSince){
    const k=Math.min(1,(now-overSince)/OVER_GRACE);
    const beat=.5+.5*Math.sin(now*.011);
    const dv=ctx.createRadialGradient(W/2,H*.5,H*.2,W/2,H*.5,H*.72);
    dv.addColorStop(0,'rgba(255,40,20,0)');
    dv.addColorStop(1,`rgba(255,40,20,${.12+k*.4*beat})`);
    ctx.fillStyle=dv;ctx.fillRect(0,0,W,H);
  }
  if(!reduce){
    ctx.globalAlpha=.035;ctx.globalCompositeOperation='overlay';
    const ox=(Math.random()*256)|0,oy=(Math.random()*256)|0;
    for(let x=-ox;x<W;x+=256)for(let y=-oy;y<H;y+=256)ctx.drawImage(grainTex,x,y);
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  }

  const tage=now-tipT;
  if(tage<4200){
    const a=tage<300?tage/300:Math.max(0,1-(tage-3200)/1000);
    ctx.globalAlpha=a;
    ctx.fillStyle='rgba(12,14,19,.9)';
    ctx.font='500 12px "IBM Plex Mono",monospace';ctx.textAlign='center';
    const tw=ctx.measureText(tipMsg).width+26;
    ctx.fillRect(W/2-tw/2,FLOOR_Y-52,tw,26);
    ctx.strokeStyle='rgba(201,162,39,.45)';ctx.lineWidth=1;
    ctx.strokeRect(W/2-tw/2,FLOOR_Y-52,tw,26);
    ctx.fillStyle='#E8E0D0';ctx.fillText(tipMsg,W/2,FLOOR_Y-34);
    ctx.textAlign='left';ctx.globalAlpha=1;
  }

  if(debug)drawDebug(now);

  const age=now-toastT;
  if(age<900){
    const el=document.getElementById('toast');
    el.textContent=toastMsg;
    el.style.opacity=age<120?age/120:Math.max(0,1-(age-400)/500);
    el.style.transform=`translate(-50%,-50%) translateY(${-age*.022}px)`;
  }
}

function drawDebug(now){
  ctx.save();
  // merkez ekseni — kayma olup olmadığını gözle görmek için
  ctx.strokeStyle='rgba(94,143,134,.5)';ctx.lineWidth=1;ctx.setLineDash([2,6]);
  ctx.beginPath();ctx.moveTo(W/2,TOP);ctx.lineTo(W/2,FLOOR_Y);ctx.stroke();ctx.setLineDash([]);

  let bodies=0,awake=0;
  for(const b of Composite.allBodies(engine.world)){
    if(b.isStatic)continue;
    bodies++;
    const{x,y}=b.position,r=b.plugin.tier<0?SLAG_R:TIERS[b.plugin.tier].r;
    // hız vektörü (×10)
    ctx.strokeStyle=Math.hypot(b.velocity.x,b.velocity.y)<.3?'#5E8F86':'#FF6B12';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+b.velocity.x*10,y+b.velocity.y*10);ctx.stroke();
    if(Math.hypot(b.velocity.x,b.velocity.y)>=.3){
      awake++;
      // yatay hız ayrıca: sistematik kaymanın kanıtı burada görünür
      ctx.strokeStyle='#6FE0FF';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(x,y+r+4);ctx.lineTo(x+b.velocity.x*60,y+r+4);ctx.stroke();
    }
    ctx.fillStyle=Math.hypot(b.velocity.x,b.velocity.y)<.3?'#5E8F86':'#E8E0D0';
    ctx.font='400 8px "IBM Plex Mono",monospace';ctx.textAlign='center';
    ctx.fillText(b.velocity.x.toFixed(3),x,y-r-4);
    ctx.fillText('ω'+b.angularVelocity.toFixed(3),x,y-r-13);
  }
  ctx.textAlign='left';
  ctx.fillStyle='rgba(12,14,19,.9)';ctx.fillRect(8,H-232,172,86);
  ctx.fillStyle='#6FE0FF';ctx.font='400 9px "IBM Plex Mono",monospace';
  const sx=(cv.width/W).toFixed(2),sy=(cv.height/H).toFixed(2);
  const bigR=sprLit[MAXT]?sprLit[MAXT].width:0;
  ctx.fillText(`fps ${fps.toFixed(0)}   cisim ${bodies}`,14,H-218);
  ctx.fillText(`dpr ${(devicePixelRatio||1).toFixed(2)} -> ${renderScale().toFixed(2)}`,14,H-206);
  ctx.fillText(`css ${cv.getBoundingClientRect().width.toFixed(0)}x${cv.getBoundingClientRect().height.toFixed(0)}`,14,H-194);
  ctx.fillText(`tuval ${cv.width}x${cv.height}`,14,H-182);
  ctx.fillText(`olcek ${sx} / ${sy}`,14,H-170);
  ctx.fillText(`SS ${SS.toFixed(2)}  sprite ${bigR}px`,14,H-158);
  ctx.fillStyle=dt_aktif?'#FFB86B':'#6FE0FF';
  ctx.fillText(dt_aktif?('olcum '+dt_n+'/20'):dt_ozet,14,H-146);
  ctx.restore();
}

/* Rakip aynası: sol alt köşede küçük panel. Fizik değil özet gösterir —
   skor, ısı, doluluk çubuğu. Sağda: GELEN SALDIRI göstergesi; kuyruk
   doluysa kırmızı sütun düşme anına doğru yanıp söner. Savunmanın görünür
   olması şart: oyuncu "birleşirsem şunu silerim" ilişkisini görmeli.      */
function drawMP(now){
  // rakip paneli
  const px=14,py=H-176,pw=104,ph=64;
  ctx.fillStyle='rgba(12,14,19,.85)';ctx.fillRect(px,py,pw,ph);
  ctx.strokeStyle='#3D4450';ctx.lineWidth=1;ctx.strokeRect(px,py,pw,ph);
  ctx.fillStyle='#8A8272';ctx.font='600 8px "IBM Plex Mono",monospace';
  ctx.fillText('RAKİP',px+8,py+14);
  ctx.fillStyle='#E8E0D0';ctx.font='700 20px "Big Shoulders Display",sans-serif';
  ctx.fillText(MP.rakip.s|0,px+8,py+36);
  // doluluk çubuğu: rakibin yığını taşmaya ne kadar yakın
  const dol=Math.max(0,Math.min(1,MP.rakip.y||0));
  ctx.fillStyle='#252B3D';ctx.fillRect(px+8,py+46,pw-16,6);
  ctx.fillStyle=dol>.75?'#FF4A28':dol>.5?'#FF8A2B':'#5E8F86';
  ctx.fillRect(px+8,py+46,(pw-16)*dol,6);

  // gelen saldırı kuyruğu
  if(MP.gelen>0&&MP.gelenT){
    const kalan=Math.max(0,MP.gelenT-now)/3000;
    const gx=W-26,gy0=TOP+40,gh=140;
    const yuk=Math.min(1,MP.gelen/50)*gh;
    const yanip=kalan<.35?(.5+.5*Math.sin(now*.02)):1;
    ctx.fillStyle=`rgba(255,60,30,${.55*yanip})`;
    ctx.fillRect(gx,gy0+gh-yuk,10,yuk);
    ctx.strokeStyle='#FF4A28';ctx.strokeRect(gx,gy0,10,gh);
    ctx.fillStyle='#FF6B4A';ctx.font='700 11px "IBM Plex Mono",monospace';
    ctx.textAlign='center';ctx.fillText(MP.gelen,gx+5,gy0-6);ctx.textAlign='left';
  }
}

/* ══════════ DÖNGÜ ══════════ */
let last=performance.now();
function loop(now){
  const dt=Math.min(33,now-last);last=now;
  fpsAcc+=dt;fpsN++;
  bakeStep();                       // kare başına en fazla bir kademe pişir

  if(fpsAcc>=500){fps=1000/(fpsAcc/fpsN);fpsAcc=0;fpsN=0;}

  // her karede yumuşayan değerler
  shownScore+=(score-shownScore)*.19;
  scorePunch*=.9;multPunch*=.9;flash*=.86;zoom+=(1-zoom)*.11;
  if(engine)for(const b of Composite.allBodies(engine.world)){
    if(b.isStatic||!b.plugin)continue;
    b.plugin.sq+=(0-b.plugin.sq)*.14;
  }
  if(combo!==lastCombo){if(combo>lastCombo)multPunch=1;lastCombo=combo;}

  if(started&&!gameOver&&!paused){
    // ── SABİT ZAMAN ADIMI ──────────────────────────────────────────
    // Matter.js 60 Hz için ayarlı. Gerçek kare süresini doğrudan vermek
    // titreme, içe geçme ve cihazdan cihaza farklı davranış üretiyor.
    // Biriktirici, ekran kaç Hz olursa olsun fiziği hep 60 Hz'te koşturur.
    engine.timing.timeScale=ending?.22:1;
    acc+=dt;
    let steps=0;
    while(acc>=FIXED&&steps<5){
      Engine.update(engine,FIXED);physStep++;

      /* DÖNME SÖNÜMÜ — tek müdahale, yalnızca AÇISAL hıza.
         Matter'ın daireleri çokgendir; bir çokgenin devrilmesi için dönmesi
         gerekir. Dönme kesilirse cisim indiği yerde kalır.
         Doğrusal hıza DOKUNULMUYOR: eski sürümdeki "ağır çekim" hissi
         doğrusal hız kelepçesinden geliyordu, o hata tekrarlanmıyor. */
      for(const b of Composite.allBodies(engine.world)){
        if(b.isStatic)continue;
        const w=b.angularVelocity*ANG_DAMP;
        Body.setAngularVelocity(b,Math.abs(w)<ANG_MIN?0:w);
      }

      dt_adim();
      flush();
      acc-=FIXED;steps++;
    }
    if(steps===5)acc=0;                    // takılırsa borcu sil, spiral olmasın

    // Güvenlik ağı: hiçbir koşulda havada donmuş cisim kalmasın.
    // Normal fizikte asla tetiklenmez; yalnızca patolojik durumda dürter.
    for(const b of Composite.allBodies(engine.world)){
      if(b.isStatic||!b.plugin)continue;
      if(Math.abs(b.velocity.y)<.01&&b.position.y<FLOOR_Y-60){
        b.plugin.dur=(b.plugin.dur||0)+1;
        if(b.plugin.dur>90)Body.setVelocity(b,{x:b.velocity.x,y:.5});
      }else b.plugin.dur=0;
    }

    // Uyarı süresi dolunca cüruf düşer.
    // (Bu satır bir düzenlemede yanlışlıkla silinmişti: uyarı çıkıyor ama
    //  cüruf hiç gelmiyordu. Blok silerken dilim sınırı kaymıştı.)
    if(slagWarn&&now-slagWarn>SLAG_WARN){slag(slagX);slagWarn=0;}

    if(window.MP&&MP.aktif){
      let tepe=FLOOR_Y,adet=0;
      for(const b of Composite.allBodies(engine.world)){
        if(b.isStatic||!b.plugin)continue;
        adet++;if(b.position.y<tepe)tepe=b.position.y;
      }
      const dusenler=MP.adim(now,{s:score,h:Math.round(heat),
        y:Math.round((1-(tepe-LINE_Y)/(FLOOR_Y-LINE_Y))*100)/100,n:adet});
      for(const d of dusenler){
        const x=pickSlagX();
        slag(x);
        if(d.buyuk){            // büyük cüruf: son ekleneni şişir
          const bodies=Composite.allBodies(engine.world);
          const son=bodies[bodies.length-1];
          if(son&&son.plugin&&son.plugin.tier<0){
            Body.scale(son,1.45,1.45);
            son.plugin.maxLife=son.plugin.life=SLAG_LIFE*1.6;
          }
        }
      }
      if(dusenler.length)toast('SALDIRI GELDİ');
      if(MP.sonuc){mpBitir(MP.sonuc);}
    }

    // cüruf yanarak eriyor; pota sıcakken daha hızlı
    for(const b of Composite.allBodies(engine.world)){
      if(b.isStatic||!b.plugin||b.plugin.tier>=0)continue;
      b.plugin.life-=dt*(1+heat/70);
      if(b.plugin.life<=0)burnOff(b);
    }
    if(Math.abs(inset-targetInset)>.3){inset+=(targetInset-inset)*.13;moveWalls();}
    let spill=false;
    for(const b of Composite.allBodies(engine.world)){
      if(b.isStatic||!b.plugin.settled)continue;
      if(b.plugin.dead)continue;      // kaynayan çift 150ms içinde yok olacak
      const r=b.plugin.tier<0?SLAG_R:TIERS[b.plugin.tier].r;
      if(b.position.y-r<LINE_Y&&Math.abs(b.velocity.y)<1.2){spill=true;break;}
    }
    if(spill){
      if(!overSince)overSince=now;
      else{
        if(now-lastBeat>520){lastBeat=now;beep(52,.15,'sine',.08);}
        if(now-overSince>OVER_GRACE)end();
      }
    } else overSince=0;
    if(ending&&now-ending>820){finishEnd();}
    syncTools();
  }
  if(engine)draw(now);
  requestAnimationFrame(loop);
}
function mpBitir(sonuc){
  if(gameOver)return;
  gameOver=true;
  const st=document.getElementById('stats');
  document.getElementById('final').textContent=score;
  document.getElementById('bestline').textContent=
    sonuc==='win'?'KAZANDIN':sonuc==='lose'?'RAKİP KAZANDI':'BAĞLANTI KOPTU';
  st.textContent='';
  over.classList.add('show');
  MP.kapat();
}
function end(){
  if(ending)return;
  if(window.MP&&MP.aktif)MP.ko();
  ending=performance.now();
  flash=.9;shakeMag=20;
  beep(90,.7,'sawtooth',.12);noise(.5,.14,200);buzz([40,60,140]);
}
function finishEnd(){
  ending=0;gameOver=true;shownScore=score;
  if(score>best){best=score;saveBest(best);}
  document.getElementById('final').textContent=score;
  document.getElementById('bestline').textContent='En iyi '+best;
  const st=document.getElementById('stats');
  st.textContent='';
  [[merges,'birleştirme'],['×'+maxCombo,'en uzun zincir'],
   [peak<0?'—':TIERS[peak].n,'ulaşılan metal'],[seedCode,'tohum']]
   .forEach(([v,l])=>{
     const d=document.createElement('div');
     const b=document.createElement('b');b.textContent=v;
     d.appendChild(b);d.appendChild(document.createTextNode(' '+l));
     st.appendChild(d);
   });
  over.classList.add('show');
  beep(90,.7,'sawtooth',.12);buzz([40,60,140]);
}

fit();                                  // ölçeği belirler ve ilk pişirmeyi tetikler
if(!bakedSS){SS=targetSS();buildTextures();bakeSpheres();}
// damga yazı tipi geç yüklenirse yüzey katmanını tazele (ışık katmanı etkilenmez)
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{
  try{for(let t=0;t<TIERS.length;t++)if(sprTex[t])sprTex[t]=bakeTex(t);fit();}catch(e){}
});
engine=Engine.create();makeWalls();          // başlangıç ekranı için boş sahne
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{});
requestAnimationFrame(loop);
