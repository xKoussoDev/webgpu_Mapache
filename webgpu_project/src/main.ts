/// <reference types="@webgpu/types" />
import "./style.css";
import shaderCode from "./shader.wgsl?raw";
import { Camera } from "./camera";
import { mat4 } from "./math";

if (!navigator.gpu) {
  throw new Error("WebGPU not supported");
}

const canvas = document.querySelector("#gfx-main") as HTMLCanvasElement; //busca el canva en el html
if (!canvas) throw new Error("Canvas #gfx-main not found");

const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error("No GPU adapter found");

const device = await adapter.requestDevice();

const context = canvas.getContext("webgpu");
if (!context) throw new Error("Could not get WebGPU context");

const format = navigator.gpu.getPreferredCanvasFormat();
let depthTexture: GPUTexture | null = null;

//función para que se ajuste el tamaño del canva segun el tamaño de la ventana
function resize() {
  canvas.width = Math.max(1, Math.floor(window.innerWidth * devicePixelRatio));
  canvas.height = Math.max(1, Math.floor(window.innerHeight * devicePixelRatio));
  context.configure({ device, format, alphaMode: "premultiplied" });
  depthTexture?.destroy();
  depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],  
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST,
  });
}
resize();
window.addEventListener("resize", resize);

//caras de cubo
const vertices = new Float32Array([
  // Front (+Z)
  //Cada linea es un vertice: x,y,z,u,v
  -1, -1,  1, 0, 1,
   1, -1,  1, 1, 1,
   1,  1,  1, 1, 0,
  -1, -1,  1, 0, 1,
   1,  1,  1, 1, 0,
  -1,  1,  1, 0, 0,
  // Back (-Z)
   1, -1, -1, 0, 1,
  -1, -1, -1, 1, 1,
  -1,  1, -1, 1, 0,
   1, -1, -1, 0, 1,
  -1,  1, -1, 1, 0,
   1,  1, -1, 0, 0,
  // Left (-X)
  -1, -1, -1, 0, 1,
  -1, -1,  1, 1, 1,
  -1,  1,  1, 1, 0,
  -1, -1, -1, 0, 1,
  -1,  1,  1, 1, 0,
  -1,  1, -1, 0, 0,
  // Right (+X)
   1, -1,  1, 0, 1,
   1, -1, -1, 1, 1,
   1,  1, -1, 1, 0,
   1, -1,  1, 0, 1,
   1,  1, -1, 1, 0,
   1,  1,  1, 0, 0,
  // Top (+Y)
  -1,  1,  1, 0, 1,
   1,  1,  1, 1, 1,
   1,  1, -1, 1, 0,
  -1,  1,  1, 0, 1,
   1,  1, -1, 1, 0,
  -1,  1, -1, 0, 0,
  // Bottom (-Y)
  -1, -1, -1, 0, 1,
   1, -1, -1, 1, 1,
   1, -1,  1, 1, 0,
  -1, -1, -1, 0, 1,
   1, -1,  1, 1, 0,
  -1, -1,  1, 0, 0,
]);


const vertexCount = vertices.length / 5;

// Se crea un buffer en la GPU para guardar los vértices del cubo
const vertexBuffer = device.createBuffer({
  size: vertices.byteLength, 
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  
});


// Se copian los datos del arreglo "vertices" al buffer de la GPU
device.queue.writeBuffer(
  vertexBuffer, 
  0,            
  vertices       
);


// Se crea el módulo de shader (programa que ejecutará la GPU)
const shader = device.createShaderModule({
  label: "Textured Cube Shader", 
  code: shaderCode, 
});

// Crear el pipeline de renderizado
const pipeline = device.createRenderPipeline({
  label: "Textured Cube Pipeline",
  layout: "auto",
  vertex: {
    module: shader,
    entryPoint: "vs_main",
    buffers: [
      {
        arrayStride: 5 * 4,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 3 * 4, format: "float32x2" },
        ],
      },
    ],
  },
  fragment: {
    module: shader,
    entryPoint: "fs_main",
    targets: [{ format }],
  },
  primitive: { topology: "triangle-list", cullMode: "back" },
  depthStencil: {
    format: "depth24plus",
    depthWriteEnabled: true,
    depthCompare: "less",
  },
});

const sampler = device.createSampler({
  magFilter: "linear",
  minFilter: "linear",
  addressModeU: "repeat",
  addressModeV: "repeat",
});

// TEXTURAS PROCEDURALES
function makeProceduralTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): GPUTexture {
  const w = 128, h = 128;
  const offscreen = document.createElement("canvas");
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext("2d")!;
  draw(ctx, w, h);
  const pixels = new Uint8Array(ctx.getImageData(0, 0, w, h).data.buffer);
  const tex = device.createTexture({
    size: [w, h, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture({ texture: tex }, pixels, { bytesPerRow: w * 4, rowsPerImage: h }, [w, h, 1]);
  return tex;
}

// FUNCIÓN PARA CARGAR IMÁGENES COMO TEXTURAS
async function loadImageTexture(url: string): Promise<GPUTexture> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("No se pudo cargar la imagen: " + url);
  }

  const blob = await res.blob();
  const image = await createImageBitmap(blob);

  // Crear una textura en la GPU con el tamaño de la imagen
  const texture = device.createTexture({
    size: [image.width, image.height, 1], // ancho, alto, profundidad
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |       
      GPUTextureUsage.COPY_DST |              
      GPUTextureUsage.RENDER_ATTACHMENT,      
  });

  // Copiar la imagen directamente a la textura de la GPU
  device.queue.copyExternalImageToTexture(
    { source: image },                    
    { texture: texture },                 
    [image.width, image.height]           
  );

  return texture;
}

// Textura 0 — Tablero de ajedrez
const texChecker = makeProceduralTexture((ctx, w, h) => {

  const cellSize = 16;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {

      // Determinar si el cuadro debe ser claro u oscuro
      // Se divide la posición entre el tamaño de celda
      const isWhite =
        (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0;
      ctx.fillStyle = isWhite ? "#f0dcb4" : "#141414";// Elegir el color según el tipo de cuadro
      ctx.fillRect(x, y, 1, 1);// Dibujar un píxel en la posición (x, y)
    }
  }
});

// Textura 1 — imagen chida
const texF1 = await loadImageTexture("/src/f1_cubo.jpg");


// Textura 2 — Degradado azul a morado
const texGradient = makeProceduralTexture((ctx, w, h) => {

  const grad = ctx.createLinearGradient(0, 0, 0, h);

  grad.addColorStop(0, "#228bcc"); 

  grad.addColorStop(1, "#a700ee"); 

  ctx.fillStyle = grad;

  ctx.fillRect(0, 0, w, h);
});


// Arreglo que guarda todas las texturas disponibles
const proceduralTextures: GPUTexture[] = [ texChecker, texF1, texGradient];

// LÍMITES DEL MAPA
const MAP_MIN = { x: -5, y: -1, z: -5 };
const MAP_MAX = { x:  5, y:  1, z:  5 };

function randRange(min: number, max: number) { return min + Math.random() * (max - min); }
function randSign() { return Math.random() < 0.5 ? 1 : -1; }

// clase SpawnedCube
class SpawnedCube {

  //posición aleatoria dentro del mapa
  readonly position = {
    x: randRange(MAP_MIN.x, MAP_MAX.x),
    y: randRange(MAP_MIN.y, MAP_MAX.y),
    z: randRange(MAP_MIN.z, MAP_MAX.z),
  };

  //rotación actual del cubo
  rotation = { x: 0, y: 0, z: 0 };

  //que tan rapido gira en cada eje
  readonly angularVel = {
    x: randSign() * randRange(0.4, 1.2),
    y: randSign() * randRange(0.4, 1.2),
    z: randSign() * randRange(0.4, 1.2),
  };

  //elige una textura aleatoria del arreglode texturas
  readonly textureIndex = Math.floor(Math.random() * proceduralTextures.length);

  readonly uniformBuf: GPUBuffer = device.createBuffer({
    size: 64, //4x4 matriz x4 bytes = 64 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  readonly bindGrp: GPUBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: this.uniformBuf } },
      { binding: 1, resource: sampler },
      { binding: 2, resource: proceduralTextures[this.textureIndex].createView() },
    ],
  });

  //actualiza la rotación del cubo en cada frame
  update(dt: number) {
    this.rotation.x += this.angularVel.x * dt;
    this.rotation.y += this.angularVel.y * dt;
    this.rotation.z += this.angularVel.z * dt;
  }

  uploadMVP(vp: Float32Array) {
    const rot = this.rotation;
    const T  = mat4.translation(this.position.x, this.position.y, this.position.z);
    const S  = mat4.scaling(0.5, 0.5, 0.5);
    //rotaciones del eje
    const Rx = mat4.rotationX(rot.x);
    const Ry = mat4.rotationY(rot.y);
    const Rz = mat4.rotationZ(rot.z);
    // Orden Euler XYZ según CS184/284A (Ren Ng, pág. 47): Rxyz = Rx · Ry · Rz
    const R  = mat4.multiply(Rx, mat4.multiply(Ry, Rz)); // combina las rotaciones
    const M  = mat4.multiply(T, mat4.multiply(R, S)); // matriz modeo: primero escala, luego rota, luego mueve
    device.queue.writeBuffer(this.uniformBuf, 0, mat4.multiply(vp, M));
  }
}

// Que el cubo spawnee con la tecla "P"
const cubes: SpawnedCube[] = [];

window.addEventListener("keydown", (e) => {
  if (e.key === "p" || e.key === "P") cubes.push(new SpawnedCube());
});

const camera = new Camera();
const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key));
window.addEventListener("keyup",   (e) => keys.delete(e.key));

let lastTime = performance.now();

function frame(now: number) {
  const dt = Math.min(0.033, (now - lastTime) / 1000); // calcular el tiempo que ha pasado entre frames (en segundos)
  lastTime = now;

  camera.update(keys, dt);

  // matriz perspectiva 3D
  const aspect = canvas.width / canvas.height;
  const proj = mat4.perspective((60 * Math.PI) / 180, aspect, 0.1, 100.0);
  const view = camera.getViewMatrix();
  const vp   = mat4.multiply(proj, view);

  for (const cube of cubes) {
    cube.update(dt); //actualizar rotacion 
    cube.uploadMVP(vp); //enviar matris a la gpu
  }

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(), //textura para el canva
      clearValue: { r: 0.06, g: 0.08, b: 0.12, a: 1.0 }, //color de fondo azul
      loadOp: "clear", //limpia la pantalla antes de dibujar
      storeOp: "store", //guarda el resultado
    }],
    depthStencilAttachment: {
      view: depthTexture!.createView(),
      depthClearValue: 1.0,
      depthLoadOp: "clear",
      depthStoreOp: "store",
    },
  });

  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, vertexBuffer);

  //dibuja cada cubo
  for (const cube of cubes) {
    pass.setBindGroup(0, cube.bindGrp); //matriz mas textur 
    pass.draw(vertexCount); //dibuja el cubo
  }

  pass.end();
  device.queue.submit([encoder.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);