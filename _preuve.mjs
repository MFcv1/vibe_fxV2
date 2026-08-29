/* LE TEST QUI TRANCHE. Une LUT est une FONCTION: la meme couleur d'entree doit
 * donner la meme couleur de sortie, ou qu'elle soit dans l'image. On regroupe
 * donc les pixels par couleur d'entree EXACTE (a un pas de 8 niveaux pres) et on
 * regarde si leur sortie depend de la position. */
import sharp from 'sharp';
const S=`${process.env.HOME}/Desktop/paires-powlisher`;
const s2l=(c)=>{const v=c/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;};
const F=(t)=>(t>0.008856?Math.cbrt(t):7.787*t+16/116);
const L=(c)=>116*F(0.2126*s2l(c[0])+0.7152*s2l(c[1])+0.0722*s2l(c[2]))-16;
const med=(xs)=>{const t=[...xs].sort((a,b)=>a-b);return t.length?t[t.length>>1]:null;};
for(const p of ['p1','p2','p3']){
  const A=await sharp(`${S}/${p}-avant.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const B=await sharp(`${S}/${p}-apres.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const W=A.info.width,H=A.info.height;
  const bacs=new Map();
  for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){
    const i=(y*W+x)*3;
    const k=(A.data[i]>>3)*1024+(A.data[i+1]>>3)*32+(A.data[i+2]>>3);
    let b=bacs.get(k);if(!b){b=[];bacs.set(k,b);}
    b.push({y:y/H,L:L([B.data[i],B.data[i+1],B.data[i+2]]),Li:L([A.data[i],A.data[i+1],A.data[i+2]])});
  }
  /* on ne garde que les couleurs presentes en HAUT et en BAS du cadre */
  const utiles=[];
  for(const [k,b] of bacs){
    if(b.length<400)continue;
    const haut=b.filter(o=>o.y<0.4),bas=b.filter(o=>o.y>0.6);
    if(haut.length<80||bas.length<80)continue;
    utiles.push({k,n:b.length,Li:med(b.map(o=>o.Li)),
      Lh:med(haut.map(o=>o.L)),Lb:med(bas.map(o=>o.L)),nh:haut.length,nb:bas.length});
  }
  utiles.sort((a,b)=>b.n-a.n);
  console.log(`\n### ${p} — MEME couleur d'entree, sortie en haut vs en bas du cadre`);
  console.log('  RGB entree     n     L in    L out haut   L out bas    ECART');
  let somme=0,poids=0;
  for(const u of utiles.slice(0,12)){
    const r=((u.k/1024|0)<<3)+4,g=(((u.k/32|0)%32)<<3)+4,b=((u.k%32)<<3)+4;
    console.log(`  ${String(r).padStart(3)},${String(g).padStart(3)},${String(b).padStart(3)} ${String(u.n).padStart(7)} ${u.Li.toFixed(1).padStart(7)} ${u.Lh.toFixed(1).padStart(12)} ${u.Lb.toFixed(1).padStart(11)} ${(u.Lb-u.Lh>=0?'+':'')+(u.Lb-u.Lh).toFixed(1).padStart(8)}`);
    somme+=(u.Lb-u.Lh)*u.n;poids+=u.n;
  }
  if(poids)console.log(`  ecart moyen bas - haut, a couleur d'entree EGALE : ${(somme/poids).toFixed(1)} L*   (${utiles.length} couleurs testees)`);
  else console.log('  aucune couleur presente des deux cotes');
}
