/*
 * AURORA — une aurore boreale, pas un degrade vert.
 *
 * La scene est une nuit noire ; le ruban est le seul objet lumineux. Il est
 * modelise comme deux brins paralleles : une colonne vertebrale sinusoidale,
 * et autour d'elle une gaussienne asymetrique (serree en dessous, longue
 * trainee au-dessus) qui fait fondre la lumiere dans le noir. Les stries
 * verticales viennent d'un empilement de bruits etires en x — ce sont les
 * lignes de champ magnetique. Le tout est saupoudre d'etoiles sur grille.
 */

import { glProgram, toneRamp } from './gl.js';

export const AURORA_FIELD = { scale: 47, distortion: 62, swirl: 40, dir: 0, speed: 26 };

const FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform float u_t;
uniform vec3 u_deep;
uniform vec3 u_horizon;
uniform vec3 u_glow;
uniform vec3 u_rim;
uniform float u_drift;
uniform float u_fold;
uniform float u_freq;
uniform vec2 u_dirv;

float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453123); }
float noise2(vec2 p){
  vec2 c = floor(p);
  vec2 f = fract(p);
  f = f*f*(3.0 - 2.0*f);
  return mix(mix(hash21(c), hash21(c + vec2(1.0, 0.0)), f.x),
             mix(hash21(c + vec2(0.0, 1.0)), hash21(c + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p, int octaves){
  float sum = 0.0;
  float amp = 0.5;
  mat2 turn = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 3; i++){
    if (i >= octaves) break;
    sum += amp*noise2(p);
    p = turn*p*2.02 + vec2(37.0, 17.0);
    amp *= 0.5;
  }
  return sum;
}

void main(){
  vec2 st = gl_FragCoord.xy/u_res - 0.5;
  st.x *= u_res.x/u_res.y;
  st = mat2(u_dirv.x, u_dirv.y, -u_dirv.y, u_dirv.x)*st;
  float x = st.x;
  float sky_h = st.y + 0.5;          // 0 au pied de l'horizon, 1 au zenith
  float time = u_t*0.35;

  /* La nuit, presque uniforme : une flaque de lumiere au ras de l'horizon. */
  float foot = 1.0 - smoothstep(0.0, 0.22, sky_h);
  vec3 night = mix(u_deep, u_horizon, foot*foot*0.18);

  /* Colonne vertebrale du ruban : une sinusoide et sa seconde harmonique. */
  float amp = 0.05 + u_fold*0.22;
  float leanRay = (noise2(vec2(time*0.11, 71.3)) - 0.5)*0.9;
  float leanSpine = (noise2(vec2(time*0.07, 41.7)) - 0.5)*0.35;
  float wobble = (fbm(vec2(x*u_freq*0.6 + time*u_drift*0.3, time*0.09), 2) - 0.5)*1.6;
  float phase = time*u_drift*0.7 + wobble;
  float sf = u_freq*u_freq*0.65;     // au carre : le curseur Scale compte vraiment
  float a1 = x*sf + phase;
  float a2 = (x + 0.012)*sf + phase;
  float w1 = 0.5 + 0.5*(0.78*sin(a1) + 0.22*sin(2.0*a1 + 2.1));
  float w2 = 0.5 + 0.5*(0.78*sin(a2) + 0.22*sin(2.0*a2 + 2.1));
  float wave = (w1 - 0.5)*2.0 + x*leanSpine;
  float slope = abs(w2 - w1)/0.012;

  vec3 light = vec3(0.0);
  float cover = 0.0;

  for (int i = 0; i < 2; i++){
    float fi = float(i);
    float freq = u_freq*(1.0 + fi*0.15);
    float drift = u_drift*(0.75 + fi*0.25);

    /* Meandre de profondeur : les portions proches sont hautes et vives. */
    float near = smoothstep(0.35, 0.65, fbm(vec2(x*freq*0.5 + time*drift*0.4 + fi*21.3, fi*3.77 + time*0.07), 2));
    float texture = fbm(vec2(x*freq*2.6 + time*drift + fi*3.7, fi*7.31 + time*0.13), 3) - 0.5;
    float spine = 0.31 + fi*0.12 + amp*wave;

    /*
     * Un ruban garde une epaisseur constante PERPENDICULAIRE : vu de face,
     * sa coupe verticale s'elargit la ou il monte raide, et le pli vu par la
     * tranche empile la ligne de vue en un noeud brillant.
     */
    float m = slope*amp*2.0;
    float widen = sqrt(1.0 + min(m*m*2.5, 5.0));
    float thick = (0.17 + u_fold*0.07)*(0.7 + near*0.85)*(1.0 - fi*0.2)*widen;
    float knot = 1.0 + (0.25 + 1.15*u_fold)*smoothstep(1.1, 3.0, slope*amp*6.0);
    float surge = 0.78 + 0.22*noise2(vec2(x*1.1 - time*1.3, 5.5 + fi*2.2));
    float power = (0.6 + 0.4*near)*knot*surge;

    float u = (sky_h - spine)/thick;   // altitude locale dans le ruban

    /* Stries de champ : octaves etirees en x, inclinees et legerement evasees. */
    float rx = x*freq*(4.5 + 2.0*near) + texture*2.2 + time*drift*1.6
             + max(u, 0.0)*thick*(leanRay + x*0.22)*3.0;
    float ry = sky_h*0.8 + fi*9.13;
    float rays = 0.5*noise2(vec2(rx, ry))
               + 0.28*noise2(vec2(rx*2.7 + 13.7, ry*1.7 + 5.2))
               + 0.14*noise2(vec2(rx*6.1 + 31.9, ry*2.3 + 11.4))
               + 0.08*noise2(vec2(rx*12.3 + 57.1, ry*2.9 + 23.7));

    /* Arc calme = lueur homogene ; tempete = piquets nets. Fold fait passer. */
    float soft = 0.55 + 0.45*smoothstep(0.3, 0.7, rays);
    float hard = 0.1 + 0.9*smoothstep(0.38, 0.6, rays);
    float bundle = noise2(vec2(x*freq*1.4 + time*drift*0.8 + fi*17.3, fi*4.77));
    float flicker = 0.85 + 0.15*noise2(vec2(x*freq*3.1 + time*2.8, 7.7 + fi*3.0));
    float rayK = mix(soft, hard, u_fold)*(0.45 + 0.55*smoothstep(0.26, 0.72, bundle))*flicker;

    /* Gaussienne asymetrique : serree sous la colonne, longue au-dessus. */
    float d = u - 0.15;
    float sigma = d < 0.0 ? 0.26 : 0.55;
    float beam = exp(-(d*d)/(2.0*sigma*sigma));
    float body = beam*(0.28 + 0.72*rayK);
    float k = (1.0 - 0.7*fi)*power;

    /* La couleur vit dans le faisceau : coeur clair, corps lueur, queue froide. */
    vec3 tone = mix(u_glow, u_rim, beam*beam*0.75);
    tone = mix(tone, u_deep, smoothstep(0.35, 1.05, u)*0.5);
    tone = mix(tone, u_horizon, (1.0 - smoothstep(-0.38, -0.12, d))*0.3);

    float gain = body*(0.88 + u_fold*0.36)*k;
    light += tone*gain;
    cover += gain;
  }

  /* Etoiles : une par cellule de grille, jamais sur l'horizon ni sur le ruban. */
  vec2 grid = vec2(x, sky_h)*60.0;
  vec2 cell = floor(grid);
  float pick = hash21(cell);
  float star = 0.0;
  if (pick > 0.96){
    vec2 at = vec2(hash21(cell + 11.3), hash21(cell + 27.7))*0.6 + 0.2;
    float r = length(fract(grid) - at);
    float twinkle = 0.6 + 0.4*sin(u_t*(2.0 + pick*6.0) + pick*100.0);
    float magnitude = (pick - 0.96)/0.04;
    star = pow(max(0.0, 1.0 - r/0.14), 4.0)*(0.3 + 0.7*magnitude)*twinkle;
    star *= smoothstep(0.03, 0.12, sky_h)*clamp(1.0 - cover*2.2, 0.0, 1.0);
    star *= 1.0 - smoothstep(0.25, 0.6, dot(night, vec3(0.299, 0.587, 0.114)));
  }

  gl_FragColor = vec4(clamp(night + light + vec3(0.95, 0.97, 1.0)*star, 0.0, 1.0), 1.0);
}
`;

const UNIFORMS = ['res', 't', 'deep', 'horizon', 'glow', 'rim', 'drift', 'fold', 'freq', 'dirv'];

/* Les curseurs Scale/Distortion/Swirl pilotent frequence, pli et derive. */
const dials = (field) => ({
  freq: 1 + (1 - (field.scale ?? AURORA_FIELD.scale) / 100) * 2.8,
  fold: (field.distortion ?? AURORA_FIELD.distortion) / 100,
  drift: 0.15 + ((field.swirl ?? AURORA_FIELD.swirl) / 100) * 1.1,
});

export function paintAurora(ctx, w, h, colors, divs, field = AURORA_FIELD, time = 20.75) {
  const entry = glProgram('aurora', FRAGMENT, UNIFORMS);
  if (!entry) { paintAuroraFallback(ctx, w, h, colors, divs, field, time); return; }

  const { canvas, gl, u } = entry;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const rampKey = JSON.stringify(colors);
  if (entry.rampKey !== rampKey) {
    const tones = toneRamp(colors);
    gl.uniform3f(u.deep, ...tones.deep);
    gl.uniform3f(u.horizon, ...tones.horizon);
    gl.uniform3f(u.glow, ...tones.glow);
    gl.uniform3f(u.rim, ...tones.rim);
    entry.rampKey = rampKey;
  }

  const d = dials(field);
  gl.viewport(0, 0, w, h);
  gl.uniform2f(u.res, w, h);
  gl.uniform1f(u.t, time);
  gl.uniform1f(u.freq, d.freq);
  gl.uniform1f(u.fold, d.fold);
  gl.uniform1f(u.drift, d.drift);
  const turn = ((field.dir ?? 0) % 4) * (Math.PI / 2);
  gl.uniform2f(u.dirv, Math.cos(turn), Math.sin(turn));
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  ctx.drawImage(canvas, 0, 0, w, h);
}

/* Repli sans GPU : nuit + un ruban flou, sans stries ni etoiles. */
function paintAuroraFallback(ctx, w, h, colors, divs, field, time) {
  const tones = toneRamp(colors);
  const hex = (rgb) => `rgb(${rgb.map((v) => Math.round(v * 255)).join(',')})`;
  ctx.fillStyle = hex(tones.deep);
  ctx.fillRect(0, 0, w, h);

  const d = dials(field);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let strand = 0; strand < 2; strand++) {
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const t = x / w - 0.5;
      const y = h * (1 - (0.31 + strand * 0.12 + (0.05 + d.fold * 0.22) * Math.sin(t * d.freq * d.freq * 0.65 + time)));
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = h * (0.17 + d.fold * 0.07);
    ctx.strokeStyle = hex(strand === 0 ? tones.glow : tones.rim);
    ctx.globalAlpha = 0.5 - strand * 0.18;
    ctx.filter = `blur(${(h * 0.05).toFixed(1)}px)`;
    ctx.stroke();
  }
  ctx.restore();
}
