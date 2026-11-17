// Entrada del paquete vendor/gltf-kit.js: cargador glTF/GLB de three.js r160 + clonado de mallas con esqueleto + decodificador Meshopt.
// `three` se resuelve al global THREE de vendor/three-r160.min.js (una sola copia de three en la página).
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
window.JanusGLTF = { GLTFLoader, cloneSkinned: clone, MeshoptDecoder };
