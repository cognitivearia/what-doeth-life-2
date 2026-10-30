import * as THREE from "three";

// Cámbialos, guarda el archivo y recarga la página.
const params = {
  sectores: 6, // espejos al abrir; en la página puedes ir de 2 a 16
  sectoresMin: 2,
  sectoresMax: 16,
  grosor: 14, // tamaño del pincel al abrir, en píxeles de la pantalla
  grosorMin: 4,
  grosorMax: 72,
  plomo: 0.0085, // grosor de las líneas entre espejos
  marco: 0.020, // grosor del borde del círculo
  brillo: 0.85, // fuerza del centro del trazo, de 0 a 1
  giro: 0.045, // rotación del plano de adelante, en radianes por segundo
  giroFondo: 0.32, // el plano de atrás gira más lento. 0 lo deja quieto
  profundidad: 0.075, // cuánto se mueve el plano de adelante con el mouse
  hundir: 6.5, // segundos que el trazo tarda en pasar atrás al soltar
  fondo: 22, // segundos que el plano de atrás tarda en apagarse
  desvanecer: 2.2, // segundos que tarda en apagarse al borrar
  recorrido: 0.8, // grados de color por cada píxel del trazo
  bloom: 0.75, // fuerza del resplandor. 0 lo apaga
  eter: 16, // qué tan lejos se abre esa luz, en píxeles
  fractal: 0.85, // presencia de los fractales fuera del círculo
};

const calma = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (calma) {
  params.giro = 0;
  params.profundidad = 0;
}

const DRAW_SIZE = 2048;
const TAU = Math.PI * 2;

function lienzoNegro() {
  const canvas = document.createElement("canvas");
  canvas.width = DRAW_SIZE;
  canvas.height = DRAW_SIZE;
  const context = canvas.getContext("2d");
  context.fillStyle = "#000";
  context.fillRect(0, 0, DRAW_SIZE, DRAW_SIZE);
  return { canvas, context };
}

function texturaDe(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

const frente = lienzoNegro();
const atras = lienzoNegro();
const frontCanvas = frente.canvas;
const frontCtx = frente.context;
const backCanvas = atras.canvas;
const backCtx = atras.context;
const frontTex = texturaDe(frontCanvas);
const backTex = texturaDe(backCanvas);

const shiftFront = new THREE.Vector2();
const shiftBack = new THREE.Vector2();
const objetivo = new THREE.Vector2();

const memoria = [
  new THREE.Vector3(0.25, 0.45, 0.9),
  new THREE.Vector3(0.45, 0.28, 0.8),
  new THREE.Vector3(0.75, 0.32, 0.6),
  new THREE.Vector3(0.9, 0.48, 0.4),
];
const mostrados = memoria.map((color) => color.clone());
const julia = new THREE.Vector2(0.3, 0.42);

const uniforms = {
  uFront: { value: frontTex },
  uBack: { value: backTex },
  uAspect: { value: 1 },
  uSegments: { value: params.sectores },
  uRotFront: { value: 0 },
  uRotBack: { value: 0 },
  uShiftFront: { value: shiftFront },
  uShiftBack: { value: shiftBack },
  uHundir: { value: 0 },
  uPlomo: { value: params.plomo },
  uMarco: { value: params.marco },
  uC0: { value: mostrados[0] },
  uC1: { value: mostrados[1] },
  uC2: { value: mostrados[2] },
  uC3: { value: mostrados[3] },
  uTiempo: { value: 0 },
  uJulia: { value: julia },
  uFractal: { value: params.fractal },
};

// Este pliegue tiene que coincidir con fold() de más abajo.
const material = new THREE.ShaderMaterial({
  uniforms,
  toneMapped: false,
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uFront;
    uniform sampler2D uBack;
    uniform float uAspect;
    uniform float uSegments;
    uniform float uRotFront;
    uniform float uRotBack;
    uniform vec2 uShiftFront;
    uniform vec2 uShiftBack;
    uniform float uHundir;
    uniform float uPlomo;
    uniform float uMarco;
    uniform vec3 uC0;
    uniform vec3 uC1;
    uniform vec3 uC2;
    uniform vec3 uC3;
    uniform float uTiempo;
    uniform vec2 uJulia;
    uniform float uFractal;

    vec3 paleta(float t) {
      float x = mod(t, 4.0);
      if (x < 1.0) return mix(uC0, uC1, x);
      if (x < 2.0) return mix(uC1, uC2, x - 1.0);
      if (x < 3.0) return mix(uC2, uC3, x - 2.0);
      return mix(uC3, uC0, x - 3.0);
    }

    float juliaDe(vec2 z, vec2 c) {
      float iter = 0.0;
      for (int i = 0; i < 20; i++) {
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        if (dot(z, z) > 16.0) break;
        iter += 1.0;
      }
      return iter / 20.0;
    }

    vec3 fractales(vec2 p) {
      float ang = mod(atan(p.y, p.x), 6.28318530718);
      float serie = 5.0;
      float slice = 6.28318530718 / serie;
      float id = floor(ang / slice);
      float medio = (id + 0.5) * slice;
      vec2 centro = vec2(cos(medio), sin(medio)) * 1.12;
      vec2 local = (p - centro) * 3.4;
      local += 0.08 * vec2(sin(uTiempo * 0.17 + id), cos(uTiempo * 0.13 + id));
      vec2 semilla = uJulia + vec2(0.06 * id, -0.045 * id);
      float figura = juliaDe(local, semilla);
      float campo = juliaDe(p * 0.72, uJulia * 0.65);
      vec3 tinta = paleta(id + figura * 1.6);
      vec3 niebla = paleta(campo * 4.0 + uTiempo * 0.05);
      float filamento = pow(sin(clamp(figura, 0.0, 1.0) * 3.14159), 1.35);
      float cuerpo = pow(figura, 2.6) * 0.2;
      float mascara = exp(-dot(p - centro, p - centro) * 1.55);
      float lejos = 1.0 - smoothstep(1.05, 2.5, length(p));
      return (tinta * (filamento * 0.9 + cuerpo) * mascara + niebla * pow(campo, 1.7) * 0.2) * lejos * uFractal;
    }

    vec3 muestra(sampler2D tex, vec2 p, float rotation, float blur) {
      float radius = length(p);
      float slice = 6.28318530718 / uSegments;
      float a = mod(atan(p.y, p.x) - rotation, slice);
      a = min(a, slice - a);
      vec2 k = vec2(cos(a), sin(a)) * radius;
      k.x /= uAspect;
      vec2 uv = clamp(k * 0.5 + 0.5, 0.0, 1.0);
      vec3 color = texture2D(tex, uv).rgb;
      vec2 paso = vec2(blur / max(uAspect, 0.001), blur);
      color += texture2D(tex, clamp(uv + vec2(paso.x, 0.0), 0.0, 1.0)).rgb;
      color += texture2D(tex, clamp(uv - vec2(paso.x, 0.0), 0.0, 1.0)).rgb;
      color += texture2D(tex, clamp(uv + vec2(0.0, paso.y), 0.0, 1.0)).rgb;
      color += texture2D(tex, clamp(uv - vec2(0.0, paso.y), 0.0, 1.0)).rgb;
      return color / 5.0;
    }

    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      p.x *= uAspect;

      vec2 frenteP = p - uShiftFront;
      vec2 atrasP = (p - uShiftBack) * 0.86;
      vec3 fondo = muestra(uBack, atrasP, uRotBack, 0.014) * 0.62;
      vec3 agudo = muestra(uFront, frenteP, uRotFront, 0.0);
      vec3 blando = muestra(uFront, atrasP, uRotFront, 0.016) * 0.7;
      vec3 vidrio = fondo + mix(agudo, blando, uHundir);
      float luma = dot(vidrio, vec3(0.299, 0.587, 0.114));
      vidrio = mix(vec3(luma), vidrio, 1.28);

      float radio = 0.8;
      float rf = length(frenteP);
      float angulo = mod(atan(frenteP.y, frenteP.x) - uRotFront, 6.28318530718);
      float slice = 6.28318530718 / uSegments;
      float sector = mod(angulo, slice);
      float frontera = min(sector, slice - sector);
      float distancia = frontera * rf;

      float bordeIn = radio - uMarco;
      float linea = 1.0 - smoothstep(uPlomo * 0.78, uPlomo, distancia);
      linea *= 1.0 - smoothstep(bordeIn, bordeIn + 0.008, rf);
      float nucleo = 1.0 - smoothstep(uPlomo * 2.1, uPlomo * 3.6, rf);
      float banda = smoothstep(bordeIn - 0.002, bordeIn + 0.003, rf)
        * (1.0 - smoothstep(radio + 0.002, radio + 0.012, rf));
      float filoMarco = 1.0 - smoothstep(0.0, 0.006, abs(rf - bordeIn));
      float sombra = smoothstep(uPlomo * 3.4, uPlomo * 0.9, distancia);

      float interior = 1.0 - smoothstep(bordeIn - 0.004, bordeIn + 0.002, rf);
      vidrio *= mix(1.0, 0.55, sombra);
      vidrio *= interior;

      float luz = clamp(max(vidrio.r, max(vidrio.g, vidrio.b)), 0.0, 1.0);
      vec3 metal = mix(vec3(0.28, 0.2, 0.13), vec3(0.02, 0.016, 0.014), luz);
      float estructura = clamp(max(linea, max(nucleo, banda)), 0.0, 1.0);
      vec3 color = mix(vidrio, metal, estructura);
      color += vec3(0.62, 0.44, 0.24) * filoMarco * (1.0 - luz);
      float afuera = smoothstep(radio + 0.004, radio + 0.028, rf);
      vec3 exterior = fractales(p);
      color = mix(color, exterior, afuera);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
});

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 1);
document.body.insertBefore(renderer.domElement, document.body.firstChild);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

const destino = new THREE.WebGLRenderTarget(1, 1, {
  depthBuffer: false,
  stencilBuffer: false,
});
destino.texture.colorSpace = THREE.NoColorSpace;
destino.texture.minFilter = THREE.LinearFilter;
destino.texture.magFilter = THREE.LinearFilter;
destino.texture.generateMipmaps = false;

const bloomUniforms = {
  uScene: { value: destino.texture },
  uBloom: { value: params.bloom },
  uEter: { value: params.eter },
  uResolucion: { value: new THREE.Vector2(1, 1) },
};

const materialEter = new THREE.ShaderMaterial({
  uniforms: bloomUniforms,
  toneMapped: false,
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform sampler2D uScene;
    uniform float uBloom;
    uniform float uEter;
    uniform vec2 uResolucion;

    void main() {
      vec3 base = texture2D(uScene, vUv).rgb;
      vec2 paso = uEter / uResolucion;
      vec3 glow = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float ang = float(i) * 0.785398;
        vec2 o = vec2(cos(ang), sin(ang));
        vec3 cerca = texture2D(uScene, vUv + o * paso * 5.0).rgb;
        vec3 lejos = texture2D(uScene, vUv + o * paso * 12.0).rgb;
        float lc = max(cerca.r, max(cerca.g, cerca.b));
        float ll = max(lejos.r, max(lejos.g, lejos.b));
        glow += cerca * smoothstep(0.34, 0.82, lc);
        glow += lejos * smoothstep(0.28, 0.75, ll) * 0.7;
      }
      glow /= 13.6;
      vec3 color = base + glow * uBloom;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
});

const escenaEter = new THREE.Scene();
escenaEter.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), materialEter));

let rotation = 0;
let rotationBack = 0;
let fadeLeft = 0;
let sinkLeft = 0;
let drawing = false;
let lastPoint = null;
let tinta = 210;

const cuenta = document.getElementById("cuenta");
const pista = document.getElementById("pista");

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const densidad = renderer.getPixelRatio();
  renderer.setSize(width, height, false);
  destino.setSize(Math.floor(width * densidad), Math.floor(height * densidad));
  uniforms.uAspect.value = width / height;
  bloomUniforms.uResolucion.value.set(width * densidad, height * densidad);
}

function setSectores(value) {
  const next = Math.round(value);
  params.sectores = Math.min(params.sectoresMax, Math.max(params.sectoresMin, next));
  uniforms.uSegments.value = params.sectores;
  cuenta.textContent = String(params.sectores);
}

function setGrosor(value) {
  const next = Math.round(value);
  params.grosor = Math.min(params.grosorMax, Math.max(params.grosorMin, next));
  document.getElementById("pincel").textContent = String(params.grosor);
}

function mirar(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  objetivo.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  objetivo.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
}

function seguirMouse(dt) {
  if (drawing) return;
  const llega = 1 - Math.exp(-3.2 * dt);
  const destinoX = objetivo.x * params.profundidad;
  const destinoY = objetivo.y * params.profundidad;
  shiftFront.x += (destinoX - shiftFront.x) * llega;
  shiftFront.y += (destinoY - shiftFront.y) * llega;
  shiftBack.x += (destinoX * 0.34 - shiftBack.x) * llega;
  shiftBack.y += (destinoY * 0.34 - shiftBack.y) * llega;
}

// Misma fórmula que el shader: dobla el ángulo en un solo gajo y lo espeja.
function fold(x, y) {
  let a = Math.atan2(y, x) - rotation;
  const radius = Math.hypot(x, y);
  const slice = TAU / params.sectores;
  a %= slice;
  if (a < 0) a += slice;
  a = Math.min(a, slice - a);
  return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
}

function puntoEnLienzo(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
  const aspect = rect.width / rect.height;
  const folded = fold(nx * aspect - shiftFront.x, ny - shiftFront.y);
  const u = (folded.x / aspect) * 0.5 + 0.5;
  const v = folded.y * 0.5 + 0.5;
  return { x: u * DRAW_SIZE, y: (1 - v) * DRAW_SIZE };
}

function colorDe(hue) {
  const h = ((hue % 360) + 360) % 360;
  const s = 0.9;
  const distanciaAmarillo = Math.min(Math.abs(h - 52), 360 - Math.abs(h - 52));
  const amarillo = Math.exp(-(distanciaAmarillo ** 2) / 700);
  const l = 0.66 - amarillo * 0.14;
  const croma = s * Math.min(l, 1 - l);
  const canal = (n) => {
    const k = (n + h / 30) % 12;
    return l - croma * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [Math.round(255 * canal(0)), Math.round(255 * canal(8)), Math.round(255 * canal(4))];
}

[206, 248, 292, 338].forEach((tono, i) => {
  const [r, g, b] = colorDe(tono);
  memoria[i].set(r / 255, g / 255, b / 255);
  mostrados[i].copy(memoria[i]);
});

function radioPincel() {
  const alto = renderer.domElement.getBoundingClientRect().height || window.innerHeight;
  return params.grosor * (DRAW_SIZE / alto);
}

function recordar(hue) {
  const [r, g, b] = colorDe(hue);
  const [r2, g2, b2] = colorDe(hue + 36);
  const slot = Math.floor(hue / 24) % 4;
  memoria[slot].set(r / 255, g / 255, b / 255);
  memoria[(slot + 1) % 4].lerp(new THREE.Vector3(r2 / 255, g2 / 255, b2 / 255), 0.45);
}

function sello(x, y, hue) {
  const radio = radioPincel();
  const [r, g, b] = colorDe(hue);
  recordar(hue);
  const fuerza = params.brillo;
  const grad = frontCtx.createRadialGradient(x, y, 0, x, y, radio);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${fuerza})`);
  grad.addColorStop(0.42, `rgba(${r}, ${g}, ${b}, ${fuerza * 0.35})`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  // source-over guarda el color del trazo. lighter lo empujaba a blanco.
  frontCtx.globalCompositeOperation = "source-over";
  frontCtx.fillStyle = grad;
  frontCtx.beginPath();
  frontCtx.arc(x, y, radio, 0, TAU);
  frontCtx.fill();
  frontTex.needsUpdate = true;
}

function trazo(desde, hasta) {
  const distancia = Math.hypot(hasta.x - desde.x, hasta.y - desde.y);
  const pasos = Math.max(1, Math.ceil(distancia / (params.grosor * 0.35)));
  const avance = (distancia * params.recorrido) / pasos;
  for (let i = 0; i <= pasos; i += 1) {
    if (i > 0) tinta = (tinta + avance) % 360;
    const t = i / pasos;
    const punto = puntoEnLienzo(
      desde.x + (hasta.x - desde.x) * t,
      desde.y + (hasta.y - desde.y) * t,
    );
    sello(punto.x, punto.y, tinta);
  }
}

function ocultarPista() {
  pista.classList.add("oculta");
}

function pointerDown(event) {
  if (event.button !== 0) return;
  drawing = true;
  fadeLeft = 0;
  sinkLeft = 0;
  uniforms.uHundir.value = 0;
  ocultarPista();
  lastPoint = { x: event.clientX, y: event.clientY };
  trazo(lastPoint, lastPoint);
  try {
    renderer.domElement.setPointerCapture(event.pointerId);
  } catch (error) {
    // Sin un puntero real el navegador no deja capturarlo. El trazo sigue.
  }
}

function pointerMove(event) {
  if (!drawing || !lastPoint) return;
  const next = { x: event.clientX, y: event.clientY };
  trazo(lastPoint, next);
  lastPoint = next;
}

function pasarAtras() {
  backCtx.globalCompositeOperation = "lighter";
  backCtx.globalAlpha = 0.85;
  backCtx.drawImage(frontCanvas, 0, 0);
  backCtx.globalAlpha = 1;
  backCtx.globalCompositeOperation = "source-over";
  frontCtx.globalCompositeOperation = "source-over";
  frontCtx.fillStyle = "#000";
  frontCtx.fillRect(0, 0, DRAW_SIZE, DRAW_SIZE);
  frontTex.needsUpdate = true;
  backTex.needsUpdate = true;
  uniforms.uHundir.value = 0;
}

function pointerUp(event) {
  if (!drawing) return;
  drawing = false;
  lastPoint = null;
  sinkLeft = params.hundir;
  try {
    if (renderer.domElement.hasPointerCapture(event.pointerId)) {
      renderer.domElement.releasePointerCapture(event.pointerId);
    }
  } catch (error) {
    // Igual que al capturar: no pasa nada si el puntero ya no existe.
  }
}

function borrar() {
  fadeLeft = params.desvanecer;
  sinkLeft = 0;
  uniforms.uHundir.value = 0;
}

function apagar(dt) {
  if (fadeLeft <= 0) return;
  const paso = Math.min(dt, fadeLeft);
  const alpha = 1 - 0.02 ** (paso / params.desvanecer);
  frontCtx.globalCompositeOperation = "source-over";
  backCtx.globalCompositeOperation = "source-over";
  frontCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  backCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  frontCtx.fillRect(0, 0, DRAW_SIZE, DRAW_SIZE);
  backCtx.fillRect(0, 0, DRAW_SIZE, DRAW_SIZE);
  frontTex.needsUpdate = true;
  backTex.needsUpdate = true;
  fadeLeft -= paso;
}

function apagarFondo(dt) {
  if (fadeLeft > 0) return;
  const alpha = 1 - 0.08 ** (dt / params.fondo);
  backCtx.globalCompositeOperation = "source-over";
  backCtx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  backCtx.fillRect(0, 0, DRAW_SIZE, DRAW_SIZE);
  backTex.needsUpdate = true;
}

function hundir(dt) {
  if (drawing || sinkLeft <= 0 || fadeLeft > 0) return;
  const paso = Math.min(dt, sinkLeft);
  sinkLeft -= paso;
  uniforms.uHundir.value = 1 - sinkLeft / params.hundir;
  if (sinkLeft <= 0) pasarAtras();
}

function pintar() {
  renderer.setRenderTarget(destino);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(escenaEter, camera);
}

function guardar() {
  pintar();
  const enlace = document.createElement("a");
  const ahora = new Date();
  const dos = (n) => String(n).padStart(2, "0");
  const marca = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}-${dos(ahora.getHours())}${dos(ahora.getMinutes())}${dos(ahora.getSeconds())}`;
  enlace.href = renderer.domElement.toDataURL("image/png");
  enlace.download = `caleidoscopio-${marca}.png`;
  enlace.click();
}

renderer.domElement.addEventListener("pointerdown", pointerDown);
renderer.domElement.addEventListener("pointermove", pointerMove);
renderer.domElement.addEventListener("pointerup", pointerUp);
renderer.domElement.addEventListener("pointercancel", pointerUp);
window.addEventListener("pointermove", mirar);

document.getElementById("menos").addEventListener("click", () => setSectores(params.sectores - 1));
document.getElementById("mas").addEventListener("click", () => setSectores(params.sectores + 1));
document.getElementById("pincel-menos").addEventListener("click", () => setGrosor(params.grosor - 2));
document.getElementById("pincel-mas").addEventListener("click", () => setGrosor(params.grosor + 2));
document.getElementById("borrar").addEventListener("click", borrar);
document.getElementById("guardar").addEventListener("click", guardar);

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    guardar();
    return;
  }
  if (event.key === "[" || event.key === "-") setSectores(params.sectores - 1);
  if (event.key === "]" || event.key === "=" || event.key === "+") setSectores(params.sectores + 1);
  if (event.key === "," || event.key === "ArrowDown") setGrosor(params.grosor - 2);
  if (event.key === "." || event.key === "ArrowUp") setGrosor(params.grosor + 2);
  if (event.key === "Backspace" || event.key === "Delete") {
    event.preventDefault();
    if (!event.repeat) borrar();
  }
});

let rueda = 0;
window.addEventListener("wheel", (event) => {
  event.preventDefault();
  if (event.shiftKey) {
    setGrosor(params.grosor + (event.deltaY > 0 ? -2 : 2));
    return;
  }
  rueda += event.deltaY;
  const salto = 80;
  while (rueda >= salto) {
    setSectores(params.sectores - 1);
    rueda -= salto;
  }
  while (rueda <= -salto) {
    setSectores(params.sectores + 1);
    rueda += salto;
  }
}, { passive: false });

window.addEventListener("resize", resize);
resize();
setSectores(params.sectores);
setGrosor(params.grosor);

let ultimo = performance.now();
let tiempo = 0;
function frame(ahora) {
  const dt = Math.min(0.05, (ahora - ultimo) / 1000);
  ultimo = ahora;
  if (!calma) tiempo += dt;
  rotation = (rotation + params.giro * dt) % TAU;
  rotationBack = (rotationBack + params.giro * params.giroFondo * dt) % TAU;
  uniforms.uRotFront.value = rotation;
  uniforms.uRotBack.value = rotationBack;
  uniforms.uTiempo.value = tiempo;
  if (!calma) {
    julia.set(
      0.28 + Math.sin(tiempo * 0.08) * 0.11,
      0.4 + Math.cos(tiempo * 0.055) * 0.09,
    );
  }
  const llega = 1 - Math.exp(-0.7 * dt);
  for (let i = 0; i < mostrados.length; i += 1) mostrados[i].lerp(memoria[i], llega);
  const pulso = calma ? 1 : 0.88 + Math.sin(tiempo * 0.4) * 0.12;
  bloomUniforms.uBloom.value = params.bloom * pulso;
  seguirMouse(dt);
  hundir(dt);
  apagarFondo(dt);
  apagar(dt);
  pintar();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
