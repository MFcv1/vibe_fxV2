/*
 * SKY — un vrai ciel : des nuages, pas un degrade.
 *
 * Recette : on deforme le plan avec du bruit de Perlin (WARP), on y calcule un
 * fbm a domaine replie qui donne la masse nuageuse, puis on empile trois
 * couches d'altitude. Chaque couche est un masque `smoothstep` dont le seuil
 * suit une hauteur bruitee — c'est ce qui fait les bords dechiquetes des
 * cumulus. Les couches sont fondues en « color burn » sur quatre tons de la
 * palette, du plus clair (les cretes) au plus sombre (le fond du ciel).
 */

import { glProgram, toneRamp, PERLIN_GLSL, FBM_GLSL } from './gl.js';
import { sampleRgb, rgbCss, mix } from '../color.js';


export const SKY_FIELD = { scale: 45, distortion: 50, swirl: 40, dir: 0, speed: 22 };

const FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform float u_t;
uniform vec3 u_main;
uniform vec3 u_low;
uniform vec3 u_mid;
uniform vec3 u_high;
uniform float u_wind;
uniform float u_warp;
uniform float u_nscale;
uniform vec2 u_dirv;
uniform sampler2D u_noise;

const float BODY = 0.912;
const float EDGE = 1.9;
const float ZOOM = 0.3971;
const float GRAIN_SCALE = 2.5;
const float GRAIN = 0.014;

${PERLIN_GLSL}
${FBM_GLSL}

/* Color burn : assombrit la base par la couche, c'est ce qui creuse les nuages. */
vec3 burn(vec3 base, vec3 layer, float amount){
  return max(base + layer - vec3(1.0), vec3(0.0))*amount + base*(1.0 - amount);
}

/* Grain fin preleve dans la texture de bruit, module dans le temps. */
float filmGrain(vec2 uv, float phase){
  float a = texture2D(u_noise, uv).r - 0.5;
  float b = texture2D(u_noise, vec2(uv.x, 1.0 - uv.y)).g - 0.5;
  return mix(a, b, phase)*GRAIN;
}

void main(){
  vec2 st = gl_FragCoord.xy/u_res - 0.5;
  st.x *= u_res.x/u_res.y;
  st = mat2(u_dirv.x, u_dirv.y, -u_dirv.y, u_dirv.x)*st;

  float time = u_t*0.85;
  vec2 uv = st*(1.0/(2.0*ZOOM)) + 0.5;

  /* Deformation lente du plan : le ciel n'est jamais une grille reguliere. */
  float wx = pnoise(vec3(uv*u_nscale + vec2(0.0, 74.8572), time*0.3));
  float wy = pnoise(vec3(uv*u_nscale + vec2(203.91282, 10.0), time*0.3));
  uv += vec2(wx*2.0, wy)*u_warp;

  /* Deux octaves serrees : les filaments a la surface des nuages. */
  float wisps = pnoise(vec3(uv*18.0 + vec2(344.91282, 0.0), time*0.3))
              + pnoise(vec3(uv*39.6 + vec2(723.937, 0.0), time*0.4))*0.5;
  uv += wisps*0.02;
  uv.y -= 0.09;

  float phase = (sin(time) + 1.0)*0.5;
  vec2 grainUv = uv*GRAIN_SCALE;
  float g0 = filmGrain(grainUv, phase);
  float g1 = filmGrain(grainUv + vec2(63.861, 368.937), phase);
  float g2 = filmGrain(grainUv + vec2(453.163, 1649.808), phase);
  uv += g0;

  /* fbm replie sur lui-meme : la masse nuageuse. Le vent la fait deriver. */
  vec2 field = uv*u_nscale;
  vec2 q = vec2(fbm4(field*0.5 + u_wind*time));
  vec2 r = vec2(fbm4(field + q + vec2(0.3, 9.2) + 0.15*time),
                fbm4(field + q + vec2(8.3, 0.8) + 0.126*time));
  float f = fbm4(field + r - q);
  float body = pow((f + 0.6*f*f + 0.7*f + 0.5)*0.5, 0.55)*BODY;

  /*
   * Trois altitudes. Le seuil de chaque masque descend avec y et se fait
   * bousculer par un bruit : sans lui les nuages auraient un bord droit.
   */
  vec2 uvA = uv + vec2((body - 0.5)*1.20) + vec2(0.0, 0.025) + g0;
  float hA = vnoise(uvA*2.0 + vec2(0.0, time*0.5))*3.0;
  float lA = pow(smoothstep(hA - 1.2*EDGE, hA + 1.2*EDGE, (uvA.y - 0.5)*5.0 + 0.5), 0.8);

  vec2 uvB = uv + vec2((body - 0.5)*0.85) + vec2(0.0, 0.025) + g1;
  float hB = vnoise(uvB*4.0 + vec2(293.0, time))*2.8;
  float lB = pow(smoothstep(hB - 0.9*EDGE, hB + 0.9*EDGE, (uvB.y - 0.6)*5.0 + 0.5), 0.9);

  vec2 uvC = uv + vec2((body - 0.5)*1.10) + g2;
  float hC = vnoise(uvC*6.0 + vec2(153.0, time*1.2))*2.6;
  float lC = smoothstep(hC - 0.7*EDGE, hC + 0.7*EDGE, (uvC.y - 0.9)*6.0 + 0.5);

  vec3 col = burn(u_main, u_low, 1.0 - lA);
  col = burn(col, mix(u_main, u_mid, 1.0 - lB), lA);
  col = mix(col, mix(u_main, u_high, 1.0 - lC), lA*lB);
  gl_FragColor = vec4(col, 1.0);
}
`;

const UNIFORMS = ['res', 't', 'main', 'low', 'mid', 'high', 'wind', 'warp', 'nscale', 'dirv'];

export function paintSky(ctx, w, h, colors, divs, field = SKY_FIELD, time = 20.75) {
    const entry = glProgram('sky', FRAGMENT, UNIFORMS, { noiseTexture: true });
    if (!entry) { paintSkyFallback(ctx, w, h, colors, divs, field, time); return; }

    const { canvas, gl, u } = entry;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const rampKey = JSON.stringify(colors);
    if (entry.rampKey !== rampKey) {
        const tones = toneRamp(colors);
        gl.uniform3f(u.high, ...tones.top);
        gl.uniform3f(u.main, ...tones.main);
        gl.uniform3f(u.mid, ...tones.mid);
        gl.uniform3f(u.low, ...tones.deep);
        entry.rampKey = rampKey;
    }

    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
    gl.uniform1f(u.t, time);
    gl.uniform1f(u.nscale, 0.35 + ((field.scale ?? SKY_FIELD.scale) / 100) * 1.15);
    gl.uniform1f(u.warp, ((field.distortion ?? SKY_FIELD.distortion) / 100) * 0.47);
    gl.uniform1f(u.wind, ((field.swirl ?? SKY_FIELD.swirl) / 100) * 0.36);
    const turn = ((field.dir ?? 0) % 4) * (Math.PI / 2);
    gl.uniform2f(u.dirv, Math.cos(turn), Math.sin(turn));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.drawImage(canvas, 0, 0, w, h);
}

/*
 * Repli sans GPU : un ciel bien plus simple — un degre vertical et une bande de
 * brume ondulee. Ca ne remplace pas le shader, ca evite un canvas vide.
 */
function paintSkyFallback(ctx, w, h, colors, divs, field, time) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    for (let i = 0; i <= 10; i++) grad.addColorStop(i / 10, rgbCss(sampleRgb(colors, divs, i / 10)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const haze = mix(colors[0], '#FFFFFF', 0.4);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = haze;
    for (let band = 0; band < 4; band++) {
        const y = h * (0.25 + band * 0.16);
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= w; x += 8) {
            ctx.lineTo(x, y + Math.sin(x / (60 + band * 22) + time + band) * (h * 0.03));
        }
        ctx.lineTo(w, y + h * 0.2);
        ctx.lineTo(0, y + h * 0.2);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}
