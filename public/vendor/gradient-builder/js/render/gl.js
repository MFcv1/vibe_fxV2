/*
 * Socle WebGL partage par Sky et Aurora.
 *
 * Un seul canvas hors ecran par programme : on dessine dedans puis on recopie
 * dans le canvas 2D visible. Ca evite d'avoir a gerer deux contextes sur le
 * meme element, et l'export passe par le meme chemin que l'affichage.
 */

const VERTEX = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

/* Bruit de Perlin 3D classique (gradients tabules), utilise pour la deformation. */
export const PERLIN_GLSL = `
vec4 permute4(vec4 x){ return mod((x*34.0 + 1.0)*x, 289.0); }
vec4 invSqrtTaylor(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
vec3 quintic(vec3 t){ return t*t*t*(t*(t*6.0-15.0)+10.0); }
float pnoise(vec3 P){
  vec3 i0 = mod(floor(P), 289.0);
  vec3 i1 = mod(floor(P) + vec3(1.0), 289.0);
  vec3 f0 = fract(P);
  vec3 f1 = f0 - vec3(1.0);
  vec4 ix = vec4(i0.x, i1.x, i0.x, i1.x);
  vec4 iy = vec4(i0.yy, i1.yy);
  vec4 ixy = permute4(permute4(ix) + iy);
  vec4 a = permute4(ixy + vec4(i0.z));
  vec4 b = permute4(ixy + vec4(i1.z));

  vec4 ax = a/7.0; vec4 ay = fract(floor(ax)/7.0) - 0.5; ax = fract(ax);
  vec4 az = vec4(0.5) - abs(ax) - abs(ay);
  vec4 sa = step(az, vec4(0.0));
  ax -= sa*(step(vec4(0.0), ax) - 0.5);
  ay -= sa*(step(vec4(0.0), ay) - 0.5);

  vec4 bx = b/7.0; vec4 by = fract(floor(bx)/7.0) - 0.5; bx = fract(bx);
  vec4 bz = vec4(0.5) - abs(bx) - abs(by);
  vec4 sb = step(bz, vec4(0.0));
  bx -= sb*(step(vec4(0.0), bx) - 0.5);
  by -= sb*(step(vec4(0.0), by) - 0.5);

  vec3 g000 = vec3(ax.x, ay.x, az.x); vec3 g100 = vec3(ax.y, ay.y, az.y);
  vec3 g010 = vec3(ax.z, ay.z, az.z); vec3 g110 = vec3(ax.w, ay.w, az.w);
  vec3 g001 = vec3(bx.x, by.x, bz.x); vec3 g101 = vec3(bx.y, by.y, bz.y);
  vec3 g011 = vec3(bx.z, by.z, bz.z); vec3 g111 = vec3(bx.w, by.w, bz.w);

  vec4 na = invSqrtTaylor(vec4(dot(g000,g000), dot(g010,g010), dot(g100,g100), dot(g110,g110)));
  g000 *= na.x; g010 *= na.y; g100 *= na.z; g110 *= na.w;
  vec4 nb = invSqrtTaylor(vec4(dot(g001,g001), dot(g011,g011), dot(g101,g101), dot(g111,g111)));
  g001 *= nb.x; g011 *= nb.y; g101 *= nb.z; g111 *= nb.w;

  float n000 = dot(g000, f0);
  float n100 = dot(g100, vec3(f1.x, f0.yz));
  float n010 = dot(g010, vec3(f0.x, f1.y, f0.z));
  float n110 = dot(g110, vec3(f1.xy, f0.z));
  float n001 = dot(g001, vec3(f0.xy, f1.z));
  float n101 = dot(g101, vec3(f1.x, f0.y, f1.z));
  float n011 = dot(g011, vec3(f0.x, f1.yz));
  float n111 = dot(g111, f1);

  vec3 w = quintic(f0);
  vec4 nz = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), w.z);
  vec2 ny = mix(nz.xy, nz.zw, w.y);
  return 2.2*mix(ny.x, ny.y, w.x);
}
`;

/* Bruit de valeur lisse + fbm 4 octaves : le corps des nuages. */
export const FBM_GLSL = `
float hash2(vec2 n){ return fract(sin(dot(n, vec2(12.9898, 4.1414)))*43758.5453); }
float vnoise(vec2 p){
  vec2 c = floor(p);
  vec2 f = fract(p);
  f = f*f*(3.0 - 2.0*f);
  float m = mix(mix(hash2(c), hash2(c + vec2(1.0, 0.0)), f.x),
                mix(hash2(c + vec2(0.0, 1.0)), hash2(c + vec2(1.0, 1.0)), f.x), f.y);
  return m*m;
}
float fbm4(vec2 x){
  float sum = 0.0;
  float amp = 0.5;
  mat2 turn = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 4; i++){
    sum += amp*vnoise(x);
    x = turn*x*2.0 + vec2(100.0);
    amp *= 0.5;
  }
  return sum;
}
`;

const programs = new Map();

/* Compile un programme plein ecran ; renvoie null si WebGL manque. */
export function glProgram(key, fragment, uniformNames, { noiseTexture = false } = {}) {
  if (programs.has(key)) return programs.get(key);
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('pas de WebGL');

    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'compilation');
      gl.attachShader(program, shader);
    }
    gl.bindAttribLocation(program, 0, 'p');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'edition de liens');
    gl.useProgram(program);

    /* Un seul triangle qui deborde : moins de sommets qu'un quad, meme couverture. */
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    if (noiseTexture) {
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      const px = new Uint8Array(256 * 256 * 4);
      for (let i = 0; i < 256 * 256; i++) {
        const v = (Math.random() * 256) | 0;
        px[i * 4] = v; px[i * 4 + 1] = v; px[i * 4 + 2] = v; px[i * 4 + 3] = 255;
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, 'u_noise'), 0);
    }

    const u = Object.fromEntries(uniformNames.map((name) => [name, gl.getUniformLocation(program, `u_${name}`)]));
    const entry = { canvas, gl, program, u, rampKey: '' };
    programs.set(key, entry);
    return entry;
  } catch (error) {
    console.warn(`[${key}] WebGL indisponible, repli CPU :`, error);
    programs.set(key, null);
    return null;
  }
}

/* Les quatre tons d'une palette, du plus clair au plus sombre. */
export function toneRamp(colors) {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v) => { const u = v / 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); })
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  };
  const sorted = [...colors].sort((a, b) => lum(b) - lum(a));
  const n = sorted.length;
  const rgb = (hex) => {
    const v = parseInt(hex.slice(1), 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  };
  return {
    top: rgb(sorted[0]),
    main: rgb(sorted[Math.min(1, n - 1)]),
    mid: rgb(sorted[Math.min(2, n - 1)]),
    deep: rgb(sorted[n - 1]),
    /* Aurora lit la rampe autrement : rim le plus clair, deep le plus sombre. */
    rim: rgb(sorted[0]),
    glow: rgb(sorted[Math.min(1, n - 1)]),
    horizon: rgb(sorted[Math.min(n - 1, Math.max(1, n - 2))]),
  };
}
