import sharp from 'sharp';
const S=`${process.env.HOME}/Desktop/paires-powlisher`;
const s2l=(c)=>{const v=c/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;};
const F=(t)=>(t>0.008856?Math.cbrt(t):7.787*t+16/116);
const Lst=(c)=>116*F(0.2126*s2l(c[0])+0.7152*s2l(c[1])+0.0722*s2l(c[2]))-16;
const med=(xs)=>{const t=[...xs].sort((a,b)=>a-b);return t.length?t[t.length>>1]:null;};
const A=await sharp(`${S}/p1-avant.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
const B=await sharp(`${S}/p1-apres.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
const W=A.info.width,H=A.info.height;
const CY=72,CX=46;
const cel=Array.from({length:CY},()=>Array.from({length:CX},()=>[]));
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*3;const li=Lst([A.data[i],A.data[i+1],A.data[i+2]]);
  if(li<10)continue;
  cel[Math.min(CY-1,Math.floor(y/H*CY))][Math.min(CX-1,Math.floor(x/W*CX))]
    .push(Lst([B.data[i],B.data[i+1],B.data[i+2]])/li);
}
const val=cel.map(r=>r.map(c=>(c.length<60?null:med(c))));
/* bouche les trous par le voisin le plus proche, puis lisse une fois */
for(let it=0;it<6;it++)for(let r=0;r<CY;r++)for(let c=0;c<CX;c++)if(val[r][c]===null){
  const v=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].map(([a,b])=>val[a]?.[b]).filter(x=>x!==null&&x!==undefined);
  if(v.length)val[r][c]=v.reduce((s,x)=>s+x,0)/v.length;}
const carte=Buffer.alloc(W*H*3);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const v=val[Math.min(CY-1,Math.floor(y/H*CY))][Math.min(CX-1,Math.floor(x/W*CX))] ?? 0.5;
  const t=Math.max(0,Math.min(1,(v-0.05)/0.85));
  const i=(y*W+x)*3;
  carte[i]=Math.round(20+t*235);carte[i+1]=Math.round(10+t*180);carte[i+2]=Math.round(60+t*120);
}
const T=async(b,raw)=>raw?sharp(b,{raw:{width:W,height:H,channels:3}}).resize(340).png().toBuffer()
                        :sharp(b).resize(340).toBuffer();
const t=[await T(`${S}/p1-avant.png`),await T(`${S}/p1-apres.png`),await T(carte,true)];
const HH=(await sharp(t[0]).metadata()).height;
await sharp({create:{width:348*3,height:HH,channels:3,background:{r:18,g:18,b:18}}})
 .composite(t.map((b,i)=>({input:b,left:i*348,top:0}))).png().toFile(`${S}/le-masque.png`);
console.log('le-masque.png : son AVANT | son APRES | ce qu\'il a assombri (clair = garde, sombre = assombri)');
