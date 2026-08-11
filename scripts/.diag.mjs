import sharp from 'sharp';
import { LUT_SIZE, applyLut3dToData } from '../src/features/vibefx-studio/utils/lut3d.js';
import { getPresetLut } from '../src/features/vibefx-studio/utils/visionPresets.js';
const DIR = 'docs/lightroom/corpus-powlisher';
function hsv(r,g,b){const rn=r/255,gn=g/255,bn=b/255;const max=Math.max(rn,gn,bn),min=Math.min(rn,gn,bn);const l=(max+min)/2,d=max-min;if(d===0)return[0,0,l];const s=d/max;let h;if(max===rn)h=((gn-bn)/d+(gn<bn?6:0))*60;else if(max===gn)h=((bn-rn)/d+2)*60;else h=((rn-gn)/d+4)*60;return[h,s,l];}
async function zone(file){const{data,info}=await sharp(file).rotate().removeAlpha().raw().toBuffer({resolveWithObject:true});const rows=Math.floor(info.height*0.45);const px=[];for(let y=0;y<rows;y+=2)for(let x=0;x<info.width;x+=2){const i=(y*info.width+x)*3;const[,,l]=hsv(data[i],data[i+1],data[i+2]);if(l>=0.55)px.push(data[i],data[i+1],data[i+2]);}return new Uint8Array(px);}
function pct(a,p){const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*p))];}
function stats(name,rgb){const ch=[],hu=[];for(let i=0;i<rgb.length;i+=3){const[h,s]=hsv(rgb[i],rgb[i+1],rgb[i+2]);ch.push(s);if(s>=0.10&&h>=150&&h<=270)hu.push(h);}
console.log(`  ${name.padEnd(22)} chroma p10=${pct(ch,.1).toFixed(2)} p50=${pct(ch,.5).toFixed(2)} p75=${pct(ch,.75).toFixed(2)} p90=${pct(ch,.9).toFixed(2)} p99=${pct(ch,.99).toFixed(2)}   teinte p50=${hu.length?pct(hu,.5).toFixed(1):'-'}`);}
function apply(id,rgb){const n=rgb.length/3;const d=new Uint8ClampedArray(n*4);for(let k=0;k<n;k++){d[k*4]=rgb[k*3];d[k*4+1]=rgb[k*3+1];d[k*4+2]=rgb[k*3+2];d[k*4+3]=255;}applyLut3dToData(d,getPresetLut(id),LUT_SIZE,1);const o=new Uint8Array(rgb.length);for(let k=0;k<n;k++){o[k*3]=d[k*4];o[k*3+1]=d[k*4+1];o[k*3+2]=d[k*4+2];}return o;}
const brut=await zone(`${DIR}/img47-paire.jpg`);
console.log('\nZONE CLAIRE — distribution de la chroma (max-min)/max\n');
stats('img47 son brut',brut);
stats('img48 SA CIBLE',await zone(`${DIR}/img48-paire.jpg`));
stats('V1 sur son brut',apply('powlisher',brut));
stats('V2 sur son brut',apply('powlisher-v2',brut));
console.log('\nSes ciels FRANCS (deja ses edits, donc borne BASSE de leur entree):\n');
for(const id of [16,18,35,36,40]) stats(`img${id}`,await zone(`${DIR}/img${id}-reference.jpg`));
console.log('');
