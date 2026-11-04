declare function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: jsQR.Options): jsQR.QRCode | null;
declare namespace jsQR {
  interface QRCode {
    data: string;
    binaryData: number[];
    location: {
      topLeftCorner: { x: number; y: number };
      topRightCorner: { x: number; y: number };
      bottomLeftCorner: { x: number; y: number };
      bottomRightCorner: { x: number; y: number };
    };
  }
  interface Options {
    inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst';
  }
}
export = jsQR;
