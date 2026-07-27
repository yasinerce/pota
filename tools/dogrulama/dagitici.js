// OYUN DOSYASINDAN OTOMATİK ÇIKARILDI — elle düzenleme.
// Kaynak: pota.html, 'Adil dağıtım' bölümü.

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
let mode='free',seedCode='',rand=Math.random;
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
function rnd(){
  if(!bag.length)refillBag();
  const piece=bag.shift();
  last2=[last2[1],piece];
  return piece;
}


module.exports={hashStr,mulberry32,BAG,BAG_SZ,
  dealer(seed){let bg=[],l2=[-1,-1];const r=mulberry32(hashStr('POTA-'+seed));
    const fill=()=>{for(let a=0;a<40;a++){const left=BAG.slice(),out=[];
      let p1=l2[1],p2=l2[0],ok=true;
      for(let k=0;k<BAG_SZ;k++){const w=[];let t2=0;
        for(let t=0;t<left.length;t++){const v=(t===p1&&t===p2)?0:left[t];w.push(v);t2+=v;}
        if(t2===0){ok=false;break;}
        let rr=r()*t2,pk=0;while(rr>=w[pk]){rr-=w[pk];pk++;}
        out.push(pk);left[pk]--;p2=p1;p1=pk;}
      if(ok){bg=out;return;}}
      bg=[];for(let t=0;t<BAG.length;t++)for(let i=0;i<BAG[t];i++)bg.push(t);};
    return()=>{if(!bg.length)fill();const pc=bg.shift();l2=[l2[1],pc];return pc;};}
};
