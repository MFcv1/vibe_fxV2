import sharp from 'sharp';
const S=`${process.env.HOME}/Desktop/paires-powlisher`;
const s2l=(c)=>{const v=c/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;};
const F=(t)=>(t>0.008856?Math.cbrt(t):7.787*t+16/116);
const Lst=(c)=>116*F(0.2126*s2l(c[0])+0.7152*s2l(c[1])+0.0722*s2l(c[2]))-16;
const med=(xs)=>{const t=[...xs].sort((a,b)=>a-b);return t.length?t[t.length>>1]:null;};

/* 1. p2, gauche contre droite (le haut et le bas n'ont aucune couleur commune) */
{
  const A=await sharp(`${S}/p2-avant.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const B=await sharp(`${S}/p2-apres.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const W=A.info.width,H=A.info.height;const bacs=new Map();
  for(let y=0;y<H;y+=2)for(let x=0;x<W;x+=2){const i=(y*W+x)*3;
    const k=(A.data[i]>>3)*1024+(A.data[i+1]>>3)*32+(A.data[i+2]>>3);
    let b=bacs.get(k);if(!b){b=[];bacs.set(k,b);}
    b.push({x:x/W,L:Lst([B.data[i],B.data[i+1],B.data[i+2]])});}
  let s=0,w=0,n=0;
  for(const [,b] of bacs){if(b.length<400)continue;
    const g=b.filter(o=>o.x<0.35),d=b.filter(o=>o.x>0.65);
    if(g.length<80||d.length<80)continue;
    s+=(med(d.map(o=>o.L))-med(g.map(o=>o.L)))*b.length;w+=b.length;n++;}
  console.log(`p2 (brouillard), MEME couleur, droite moins gauche : ${(s/w).toFixed(2)} L*  (${n} couleurs)`);
}
/* 2. p1: ou tombe la couleur 204,188,164, et que devient-elle ? */
{
  const A=await sharp(`${S}/p1-avant.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const B=await sharp(`${S}/p1-apres.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const W=A.info.width,H=A.info.height;
  const CY=18,CX=9;
  const cel=Array.from({length:CY},()=>Array.from({length:CX},()=>[]));
  const tous=Array.from({length:CY},()=>Array.from({length:CX},()=>[]));
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*3;
    const li=Lst([A.data[i],A.data[i+1],A.data[i+2]]);
    if(li<12)continue;                       /* le noir n'a rien a dire */
    const r=Math.floor(y/H*CY),c=Math.floor(x/W*CX);
    tous[r][c].push(Lst([B.data[i],B.data[i+1],B.data[i+2]])/Math.max(1,li));
    if(Math.abs(A.data[i]-204)<8&&Math.abs(A.data[i+1]-188)<8&&Math.abs(A.data[i+2]-164)<8)
      cel[r][c].push(Lst([B.data[i],B.data[i+1],B.data[i+2]]));}
  console.log('\np1 : la couleur 204,188,164 (L* 77) — ou elle est, et a quel L* elle sort');
  for(let r=0;r<CY;r++){
    const l=cel[r].map(c=>c.length<40?'  .  ':med(c).toFixed(0).padStart(5)).join('');
    if(l.trim()!=='.'.repeat(CX).split('').join('   '))console.log('   '+l);
  }
  console.log('\np1 : le rapport L sortie / L entree, tout le cadre (1,00 = inchange)');
  for(let r=0;r<CY;r++)
    console.log('   '+tous[r].map(c=>c.length<200?'  .  ':med(c).toFixed(2).padStart(5)).join(''));
}
