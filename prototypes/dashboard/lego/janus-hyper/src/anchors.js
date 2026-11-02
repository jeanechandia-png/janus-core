/* anchors.js · puntos de montaje de cada criatura (coordenadas del mundo en reposo). Los accesorios se construyen en una cabeza/cuerpo de referencia y se escalan con `scale`. */
export const ANCH = {
  lumi: {
    head: { c: [0, 1.5, 0.05], top: [0, 2.14, 0.02], ears: [0, 1.5, 0.05] }, face: { c: [0, 1.55, 0.7] }, neck: { c: [0, 1.2, 0.08], rx: 0.6, rz: 0.54 }, back: { c: [0, 1.0, -0.42] },
    foot: { c: [0.22, 0.095, 0.15], r: [0.15, 0.095, 0.24] }, hand: { c: [0.51, 0.64, 0.22], dir: [0.13, -0.4, 0.16], wrist: [0.455, 0.78, 0.15] }, shoulder: [0.37, 1.08, 0.04], armEnd: [0.5, 0.68, 0.2],
    scale: { cabeza: 0.84, oidos: 1.05, cara: 0.74, cuello: 1.0, espalda: 1.0, pies: 1.0, mano: 1.0 },
    garment: { top: 1.42, hem: 0.5, front: [0, 0, 0.4], off: 0.034, ex: 'head', bounds: [-1.0, 0.3, -0.8, 1.0, 1.55, 0.75], waist: 0.82 }, skirt: { y0: 0.8, y1: 0.2, r0: [0.46, 0.4], r1: [0.98, 0.88], c: [0, 0] },
    hides: { wings: ['wings'] }
  },
  bombo: {
    head: { c: [0, 1.72, 0.1], top: [0, 2.31, 0.1], ears: [0, 1.72, 0.1] }, face: { c: [0, 1.86, 0.7] }, neck: { c: [0, 1.3, 0.0], rx: 0.74, rz: 0.64 }, back: { c: [0, 1.0, -0.72] },
    foot: { c: [0.5, 0.1, 0.3], r: [0.25, 0.1, 0.3], collar: 0.0 }, hand: { c: [1.06, 0.79, 0.33], dir: [0.3, -0.28, 0.22], wrist: [0.94, 0.88, 0.27] }, shoulder: [0.72, 1.12, 0.08], armEnd: [1.02, 0.84, 0.3],
    scale: { cabeza: 0.98, oidos: 1.12, cara: 0.8, cuello: 1.35, espalda: 1.5, pies: 1.3, mano: 1.35 },
    garment: { top: 1.34, hem: 0.34, front: [0, 0, 0.74], off: 0.04, ex: 'head', bounds: [-1.5, 0.15, -1.0, 1.5, 1.45, 1.0], waist: 0.9 }, skirt: { y0: 0.9, y1: 0.14, r0: [0.9, 0.78], r1: [1.55, 1.35], c: [0, 0] },
    hides: {}
  },
  musgo: {
    head: { c: [0, 1.1, 0.2], top: [0, 1.9, 0.0], ears: [0, 1.1, 0.0] }, face: { c: [0, 1.17, 0.86] }, neck: { c: [0, 0.5, 0.0], rx: 0.9, rz: 0.8 }, back: { c: [0, 1.0, -0.82] },
    foot: { c: [0.4, 0.1, 0.26], r: [0.34, 0.1, 0.38], collar: -0.14 }, hand: { c: [1.12, 0.56, 0.32], dir: [0.28, -0.28, 0.1], wrist: [1.02, 0.68, 0.28] }, shoulder: [0.8, 0.9, 0.2], armEnd: [1.08, 0.62, 0.3],
    scale: { cabeza: 1.0, oidos: 1.36, cara: 0.78, cuello: 1.4, espalda: 1.55, pies: 1.25, mano: 1.4 },
    garment: { top: 1.6, hem: 0.32, front: [0, 0, 0.82], off: 0.045, ex: 'face', bounds: [-1.5, 0.15, -1.0, 1.5, 1.7, 1.0], waist: 0.7 }, skirt: { y0: 0.7, y1: 0.12, r0: [1.0, 0.9], r1: [1.55, 1.4], c: [0, 0.05] },
    hides: { flower: ['flower'], ferns: ['ferns'] }
  },
  nimbo: {
    head: { c: [0, 1.6, 0.06], top: [0, 2.3, 0.04], ears: [0, 1.6, 0.06] }, face: { c: [0, 1.58, 0.78] }, neck: { c: [0, 1.15, 0.08], rx: 0.58, rz: 0.52 }, back: { c: [0, 0.95, -0.52] },
    foot: { c: [0.22, 0.09, 0.16], r: [0.14, 0.09, 0.2] }, hand: { c: [0.74, 0.82, 0.3], dir: [0.25, -0.19, 0.18], wrist: [0.66, 0.88, 0.25] }, shoulder: [0.45, 1.05, 0.1], armEnd: [0.7, 0.86, 0.28],
    scale: { cabeza: 1.0, oidos: 1.18, cara: 0.72, cuello: 1.0, espalda: 1.2, pies: 1.0, mano: 1.1 },
    garment: { top: 1.3, hem: 0.38, front: [0, 0, 0.54], off: 0.06, ex: 'head', bounds: [-1.2, 0.25, -0.8, 1.2, 1.4, 0.8], waist: 0.8 }, skirt: { y0: 0.8, y1: 0.18, r0: [0.68, 0.62], r1: [1.2, 1.05], c: [0, 0] },
    hides: {}
  }
};
