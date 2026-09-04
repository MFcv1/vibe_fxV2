/*
 * Renderer WebGL2 minimal, sans librairie.
 *
 * Il ne sait dessiner qu'une chose : un quad texture dont on fournit les 4 coins
 * en 3D. C'est suffisant pour toute la famille perspective — anneaux, spheres,
 * tunnels, helices — parce que la perspective vient de la projection des coins,
 * et que l'interpolation perspective-correcte des UV est faite par GL lui-meme
 * des lors qu'on lui donne de vraies positions 3D.
 *
 * Les coins arrivent dans l'ordre TL, TR, BR, BL.
 */

const VERT = `#version 300 es
in vec3 a_pos;
in vec2 a_uv;
uniform mat4 u_vp;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = u_vp * vec4(a_pos, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_tex;
uniform int   u_hasTex;
uniform vec3  u_color;
uniform float u_alpha;
uniform vec4  u_radius;   // rayon par coin (HG, HD, BD, BG), en fraction du petit cote
uniform float u_aspect;   // largeur / hauteur du quad, pour un rayon rond
uniform float u_fade;     // fondu vers la couleur de fond (profondeur)
uniform vec3  u_fadeColor;
uniform float u_pxScale;  // taille approx. du quad a l'ecran, pour l'antialias
uniform int   u_shadow;
uniform vec4  u_uvRect;   // cadrage de la texture (cover)
uniform vec4  u_clip;     // (nx, ny, offset, adoucissement) : demi-plan de coupe
uniform float u_glow;     // liseré clair le long de la coupe
uniform vec4  u_frameBox; // (demi-largeur, demi-hauteur, centre x, centre y) du cadre
uniform float u_frameR;   // rayon du cadre ; 0 = pas de masque de cadre
uniform int   u_finish;   // 1 = vignetage, 2 = grain, 0 = carte normale
uniform vec2  u_finishArg; // (intensite, graine)

/*
 * Distance signee a un rectangle aux quatre coins independants.
 *
 * Un rayon par coin n'est pas une coquetterie : quand une image est revelee en
 * bandes ou en tuiles, chaque morceau est un quad separe, et seuls les morceaux
 * du bord doivent porter l'arrondi. Avec un rayon unique, la composition
 * ressortait avec des coins carres ou des trous.
 */
float roundedBox(vec2 p, vec2 half_, vec4 r) {
  float rr = p.x > 0.0 ? (p.y < 0.0 ? r.y : r.z) : (p.y < 0.0 ? r.x : r.w);
  vec2 q = abs(p) - half_ + rr;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr;
}

void main() {
  /*
   * Passes de finition : un voile plein cadre qui assombrit les bords, puis un
   * grain leger. Ce sont elles qui font basculer le rendu du cote "video" — un
   * aplat parfaitement propre et uniformement eclaire lit toujours comme une
   * diapositive.
   */
  if (u_finish == 1) {
    vec2 q = (v_uv - 0.5) * vec2(u_aspect, 1.0);
    float r = length(q) / 0.62;
    outColor = vec4(0.0, 0.0, 0.0, smoothstep(0.45, 1.25, r) * u_finishArg.x);
    return;
  }
  if (u_finish == 2) {
    float n = fract(sin(dot(v_uv * u_finishArg.y, vec2(12.9898, 78.233))) * 43758.5453);
    outColor = vec4(vec3(n), u_finishArg.x);
    return;
  }

  // On travaille dans un repere ou la largeur vaut u_aspect et la hauteur 1,
  // sinon le rayon de coin serait ovale sur les cartes non carrees.
  vec2 half_ = vec2(u_aspect, 1.0) * 0.5;
  vec2 p = (v_uv - 0.5) * vec2(u_aspect, 1.0);
  vec4 r = u_radius * min(half_.x, half_.y) * 2.0;
  float d = roundedBox(p, half_, r);

  float aa = max(1.0 / max(u_pxScale, 1.0), 0.0015);
  float mask = 1.0 - smoothstep(-aa, aa, d);

  /*
   * Coupe par demi-plan : c'est elle qui fait les balayages et les revelations.
   * Une carte n'est alors pas redimensionnee, elle est rognee — l'image reste
   * donc immobile pendant que son bord avance, ce qui est le mouvement voulu.
   */
  float edge = 0.0;
  if (u_clip.x != 0.0 || u_clip.y != 0.0) {
    float side = dot(v_uv - 0.5, u_clip.xy) - u_clip.z;
    float soft = max(u_clip.w, aa);
    mask *= 1.0 - smoothstep(-soft, soft, side);
    edge = 1.0 - smoothstep(0.0, soft * 3.0 + 0.004, abs(side));
  }
  /*
   * Masque de cadre : quand une image est revelee en bandes ou en tuiles, chaque
   * morceau est un quad separe et ne sait rien des coins arrondis de l'image
   * entiere. On lui donne donc le rectangle du cadre, exprime dans SON repere,
   * et on croise les deux masques. Sans ca, une revelation terminee ressortait
   * avec des coins carres la ou l'image posee dessous etait arrondie.
   */
  if (u_frameR > 0.0) {
    vec2 fp = p - u_frameBox.zw;
    float fd = roundedBox(fp, u_frameBox.xy, vec4(u_frameR));
    mask *= 1.0 - smoothstep(-aa, aa, fd);
  }
  if (mask <= 0.0) discard;

  if (u_shadow == 1) {
    // L'ombre est un aplat sombre adouci vers ses bords.
    float soft = 1.0 - smoothstep(-0.16, 0.02, d);
    outColor = vec4(0.0, 0.0, 0.0, soft * u_alpha);
    return;
  }

  vec3 rgb = u_color;
  if (u_hasTex == 1) {
    vec2 uv = u_uvRect.xy + v_uv * u_uvRect.zw;
    rgb = texture(u_tex, uv).rgb;
  }
  rgb = mix(rgb, u_fadeColor, clamp(u_fade, 0.0, 1.0));
  if (u_glow > 0.0) rgb = mix(rgb, vec3(1.0), edge * u_glow);
  outColor = vec4(rgb, mask * u_alpha);
}`;

function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
    }
    return sh;
}

export default class QuadRenderer {
    constructor(canvas) {
        const gl = canvas.getContext('webgl2', {
            alpha: false, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false,
        });
        if (!gl) throw new Error('WebGL2 indisponible');
        this.gl = gl;
        this.canvas = canvas;

        const prog = gl.createProgram();
        gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error(`link: ${gl.getProgramInfoLog(prog)}`);
        }
        this.prog = prog;
        gl.useProgram(prog);

        this.u = {};
        [
            'u_vp', 'u_tex', 'u_hasTex', 'u_color', 'u_alpha', 'u_radius', 'u_aspect',
            'u_fade', 'u_fadeColor', 'u_pxScale', 'u_shadow', 'u_uvRect', 'u_clip', 'u_glow', 'u_frameBox', 'u_frameR',
            'u_finish', 'u_finishArg',
        ].forEach((name) => { this.u[name] = gl.getUniformLocation(prog, name); });

        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        this.posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, 12 * 4, gl.DYNAMIC_DRAW);
        const aPos = gl.getAttribLocation(prog, 'a_pos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

        const uvBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
        // TL, TR, BR, BL rendu en TRIANGLE_STRIP : TL, BL, TR, BR.
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
        const aUv = gl.getAttribLocation(prog, 'a_uv');
        gl.enableVertexAttribArray(aUv);
        gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

        this.scratch = new Float32Array(12);
        gl.uniform1i(this.u.u_tex, 0);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    resize(w, h) {
        if (this.canvas.width === w && this.canvas.height === h) return;
        this.canvas.width = w;
        this.canvas.height = h;
    }

    beginFrame(bg) {
        const { gl } = this;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(bg[0], bg[1], bg[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(this.prog);
        gl.bindVertexArray(this.vao);
    }

    setCamera(vp) {
        this.gl.uniformMatrix4fv(this.u.u_vp, false, vp);
    }

    /*
     * `quad.p` = [TL, TR, BR, BL], chaque coin en [x, y, z] monde.
     */
    draw(quad, fadeColor) {
        const { gl, u } = this;
        const p = quad.p;
        const s = this.scratch;
        // Ordre du TRIANGLE_STRIP : TL, BL, TR, BR.
        const order = [0, 3, 1, 2];
        for (let i = 0; i < 4; i += 1) {
            const c = p[order[i]];
            s[i * 3] = c[0]; s[i * 3 + 1] = c[1]; s[i * 3 + 2] = c[2];
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, s);

        const tex = quad.tex;
        gl.uniform1i(u.u_hasTex, tex ? 1 : 0);
        if (tex) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, tex.handle);
            const rect = quad.uvRect || [0, 0, 1, 1];
            gl.uniform4f(u.u_uvRect, rect[0], rect[1], rect[2], rect[3]);
        }
        const col = quad.color || [0.5, 0.5, 0.5];
        gl.uniform3f(u.u_color, col[0], col[1], col[2]);
        gl.uniform1f(u.u_alpha, quad.alpha === undefined ? 1 : quad.alpha);
        // `radius` accepte un nombre (les quatre coins) ou [HG, HD, BD, BG].
        const rad = quad.radius || 0;
        if (Array.isArray(rad)) gl.uniform4f(u.u_radius, rad[0], rad[1], rad[2], rad[3]);
        else gl.uniform4f(u.u_radius, rad, rad, rad, rad);
        gl.uniform1f(u.u_aspect, quad.aspect || 1);
        gl.uniform1f(u.u_fade, quad.fade || 0);
        gl.uniform3f(u.u_fadeColor, fadeColor[0], fadeColor[1], fadeColor[2]);
        gl.uniform1f(u.u_pxScale, quad.pxScale || this.canvas.width * 0.25);
        gl.uniform1i(u.u_shadow, quad.shadow ? 1 : 0);
        const clip = quad.clip || [0, 0, 0, 0];
        gl.uniform4f(u.u_clip, clip[0], clip[1], clip[2], clip[3]);
        gl.uniform1f(u.u_glow, quad.glow || 0);
        // `frameMask` = [demi-largeur, demi-hauteur, centre x, centre y, rayon],
        // exprime dans le repere local du quad (hauteur = 1).
        const fm = quad.frameMask;
        gl.uniform4f(u.u_frameBox, fm ? fm[0] : 0, fm ? fm[1] : 0, fm ? fm[2] : 0, fm ? fm[3] : 0);
        gl.uniform1f(u.u_frameR, fm ? fm[4] : 0);
        gl.uniform1i(u.u_finish, quad.finish || 0);
        const fa = quad.finishArg || [0, 0];
        gl.uniform2f(u.u_finishArg, fa[0], fa[1]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    createTexture(source) {
        const { gl } = this;
        const handle = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, handle);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);
        const ext = gl.getExtension('EXT_texture_filter_anisotropic');
        if (ext) {
            gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT,
                Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        }
        return { handle, width: source.width, height: source.height };
    }

    destroyTexture(tex) {
        if (tex?.handle) this.gl.deleteTexture(tex.handle);
    }
}
