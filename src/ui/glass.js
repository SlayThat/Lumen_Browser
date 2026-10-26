'use strict';
// Liquid Glass style renderer (WebGL2).
//
// This is an approximation of the material. It is NOT Apple's shader. The layers it draws:
//   - rounded-rectangle signed-distance-field shapes (one per [data-glass] element)
//   - edge refraction: the backdrop is sampled with an offset that is strong at the rim and
//     falls to zero toward the middle, plus a small per-channel (RGB) dispersion at the rim
//   - blur that is soft in the middle and sharp at the rim
//   - saturation boost so the blur does not turn grey
//   - tint that adapts to the brightness of the page behind it, to keep text legible
//   - rim light: bright on top and bottom edges, darker on the left and right
//   - soft shadow, thicker glass casting a deeper one, and a little grain against banding
// The backdrop is a frame of the page captured by the main process (BGRA, half resolution).
(function () {
  const MAX = 16;
  const VS = `#version 300 es
in vec2 a;
void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

  const FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uCap;
uniform vec2 uView;
uniform float uDpr;
uniform int uCount;
uniform vec4 uS[${MAX}];   // cx, cy, halfW, halfH   (CSS px)
uniform vec4 uP[${MAX}];   // radius, thickness, strength (0..1), unused
uniform float uBlur, uRefr, uDisp, uSat, uTint, uLum, uDark, uHave, uRim, uMirror;
uniform vec3 uTintCol;
out vec4 o;

float sdr(vec2 q, vec2 hw, float r){
  vec2 d = abs(q) - hw + r;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
}
vec3 T(vec2 c){
  // uMirror > 0: the texture is the top of the page. Fold it upward around the toolbar's bottom edge.
  if (uMirror > 0.0) c.y = c.y < uMirror ? uMirror - c.y : c.y - uMirror;
  return texture(uTex, clamp(c / uCap, vec2(0.002), vec2(0.998))).bgr;
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  vec2 c = vec2(gl_FragCoord.x / uDpr, uView.y - gl_FragCoord.y / uDpr);
  int hit = -1;
  float shadow = 0.0;
  for (int i = 0; i < ${MAX}; i++){
    if (i >= uCount) break;
    vec4 s = uS[i]; vec4 p = uP[i];
    vec2 q = c - s.xy;
    float d = sdr(q, s.zw, p.x);
    float ds = sdr(q - vec2(0.0, 5.0 + 9.0 * p.y), s.zw, p.x);
    shadow = max(shadow, exp(-max(ds, 0.0) / (6.0 + 14.0 * p.y)) * mix(0.16, 0.30, uDark) * p.y * p.z);
    if (d < 0.0) hit = i;
  }
  if (hit < 0){ o = vec4(0.0, 0.0, 0.0, shadow); return; }

  vec4 s = uS[hit]; vec4 p = uP[hit];
  vec2 q = c - s.xy;
  float d = sdr(q, s.zw, p.x);
  float depth = -d;
  float m = clamp(p.z, 0.0, 1.0);
  float bevel = min(mix(9.0, 26.0, p.y), min(s.z, s.w) * 0.92);
  float k = clamp(depth / bevel, 0.0, 1.0);
  float f = pow(1.0 - k, 2.2);

  vec2 e = vec2(1.0, 0.0);
  vec2 g = vec2(sdr(q + e.xy, s.zw, p.x) - sdr(q - e.xy, s.zw, p.x),
                sdr(q + e.yx, s.zw, p.x) - sdr(q - e.yx, s.zw, p.x));
  float gl = length(g);
  g = gl > 1e-4 ? g / gl : vec2(0.0);

  vec2 off = g * uRefr * (0.45 + 0.7 * p.y) * f * m;
  float br = uBlur * smoothstep(0.0, 0.85, k) * (0.55 + 0.45 * p.y);

  vec3 col;
  if (uHave > 0.5){
    vec3 acc = vec3(0.0);
    float rot = hash(gl_FragCoord.xy) * 6.2831;
    for (int i = 0; i < 14; i++){
      float fi = float(i);
      float a = fi * 2.39996 + rot;
      float rr = sqrt((fi + 0.5) / 14.0);
      acc += T(c + off + vec2(cos(a), sin(a)) * rr * br);
    }
    col = acc / 14.0;
    if (uDisp > 0.001){
      float dm = uDisp * f;
      vec3 rim = vec3(T(c + off * (1.0 + dm * 3.0)).r, T(c + off).g, T(c + off * (1.0 - dm * 3.0)).b);
      col = mix(col, rim, pow(1.0 - k, 1.5));
    }
  } else {
    col = uTintCol;
  }

  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);

  float target = mix(0.9, 0.12, uDark);
  float mis = abs(uLum - target);
  float ta = clamp(uTint + 0.34 * smoothstep(0.35, 0.95, mis), 0.0, 0.9);
  if (uHave < 0.5) ta = 0.9;
  col = mix(col, uTintCol, ta);

  float edge = 1.0 - smoothstep(0.0, 1.6, depth);
  float inner = 1.0 - smoothstep(0.0, 7.0 + 6.0 * p.y, depth);
  float dirw = mix(-0.34, 0.95, g.y * g.y);
  float light = (edge * 0.85 + inner * 0.22) * dirw * uRim * m * (0.7 + 0.3 * p.y);
  col = light > 0.0 ? mix(col, vec3(1.0), clamp(light, 0.0, 0.9)) : col * (1.0 + light * 0.55);
  col = mix(col, uDark > 0.5 ? vec3(1.0) : vec3(0.0), edge * 0.09);

  float sh2 = 0.0;
  for (int j = 0; j < ${MAX}; j++){
    if (j >= uCount) break;
    if (j <= hit) continue;
    vec4 s2 = uS[j]; vec4 p2 = uP[j];
    float dd = sdr(c - s2.xy - vec2(0.0, 3.0 + 6.0 * p2.y), s2.zw, p2.x);
    sh2 = max(sh2, exp(-max(dd, 0.0) / (4.0 + 8.0 * p2.y)) * mix(0.14, 0.22, uDark) * p2.y * p2.z);
  }
  col *= 1.0 - sh2;
  col += (hash(gl_FragCoord.xy + 17.0) - 0.5) * 0.035;

  float aa = smoothstep(0.5, -0.5, d) * m;
  o = vec4(clamp(col, 0.0, 1.0) * aa, aa);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile failed:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  class GlassRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ok = false;
      this.have = 0;
      this.count = 0;
      this.S = new Float32Array(MAX * 4);
      this.P = new Float32Array(MAX * 4);
      this.view = { w: 1, h: 1, dpr: 1 };
      this.cap = { w: 1, h: 1 };
      this.p = { blur: 9, refr: 24, disp: 0.16, sat: 1.18, tint: 0.16, lum: 0.5, dark: 0, rim: 1, tintCol: [0.95, 0.96, 0.98], mirror: 0 };
      this.onLost = null;

      const gl = canvas.getContext('webgl2', {
        alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
        failIfMajorPerformanceCaveat: true, powerPreference: 'low-power'
      });
      if (!gl) return;
      this.gl = gl;
      const vs = compile(gl, gl.VERTEX_SHADER, VS);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
      if (!vs || !fs) return;
      const pr = gl.createProgram();
      gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.error('Link failed:', gl.getProgramInfoLog(pr)); return; }
      gl.useProgram(pr);
      this.pr = pr;
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(pr, 'a');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      this.u = {};
      ['uTex', 'uCap', 'uView', 'uDpr', 'uCount', 'uS', 'uP', 'uBlur', 'uRefr', 'uDisp', 'uSat', 'uTint', 'uLum', 'uDark', 'uHave', 'uRim', 'uMirror', 'uTintCol']
        .forEach(n => { this.u[n] = gl.getUniformLocation(pr, n); });
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(this.u.uTex, 0);
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ok = false; if (this.onLost) this.onLost(); });
      this.ok = true;
    }

    setView(w, h, dpr) {
      this.view = { w, h, dpr };
      this.canvas.width = Math.max(1, Math.round(w * dpr));
      this.canvas.height = Math.max(1, Math.round(h * dpr));
    }

    setFrame(f) {
      if (!this.ok || !f || !f.buf) return;
      const w = f.w, h = f.h;
      let u8 = f.buf;
      if (u8 instanceof ArrayBuffer) u8 = new Uint8Array(u8);
      else if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8.buffer || u8);
      if (u8.length < w * h * 4) return;
      if (u8.length !== w * h * 4) u8 = u8.subarray(0, w * h * 4);
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, u8);
      this.cap = { w: f.cw || w * 2, h: f.ch || h * 2 };
      this.have = 1;
      this.p.lum = typeof f.lum === 'number' ? f.lum : 0.5;
      this.p.mirror = f.mirror || 0;
    }

    clearFrame() { this.have = 0; }

    // shapes: array of [cx, cy, halfW, halfH, radius, thickness, strength]
    setShapes(list) {
      const n = Math.min(list.length, MAX);
      for (let i = 0; i < n; i++) {
        const s = list[i];
        this.S[i * 4] = s[0]; this.S[i * 4 + 1] = s[1]; this.S[i * 4 + 2] = s[2]; this.S[i * 4 + 3] = s[3];
        this.P[i * 4] = s[4]; this.P[i * 4 + 1] = s[5]; this.P[i * 4 + 2] = s[6]; this.P[i * 4 + 3] = 0;
      }
      this.count = n;
    }

    setParams(p) { Object.assign(this.p, p); }

    draw() {
      if (!this.ok) return;
      const gl = this.gl, u = this.u, p = this.p;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!this.count) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.uniform2f(u.uCap, this.cap.w, this.cap.h);
      gl.uniform2f(u.uView, this.view.w, this.view.h);
      gl.uniform1f(u.uDpr, this.view.dpr);
      gl.uniform1i(u.uCount, this.count);
      gl.uniform4fv(u.uS, this.S);
      gl.uniform4fv(u.uP, this.P);
      gl.uniform1f(u.uBlur, p.blur); gl.uniform1f(u.uRefr, p.refr); gl.uniform1f(u.uDisp, p.disp);
      gl.uniform1f(u.uSat, p.sat); gl.uniform1f(u.uTint, p.tint); gl.uniform1f(u.uLum, p.lum);
      gl.uniform1f(u.uDark, p.dark); gl.uniform1f(u.uHave, this.have); gl.uniform1f(u.uRim, p.rim); gl.uniform1f(u.uMirror, p.mirror);
      gl.uniform3f(u.uTintCol, p.tintCol[0], p.tintCol[1], p.tintCol[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  window.GlassRenderer = GlassRenderer;
})();
