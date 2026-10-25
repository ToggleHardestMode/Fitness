import { validateWalkerDataUrl } from './dashboard-walker.js';

// Capture one motionless PNG frame locally. No server access or workout writes.
export function createWalkerStill(dataUrl, makeImage = () => new Image(), makeCanvas = () => document.createElement('canvas')) {
  validateWalkerDataUrl(dataUrl);
  return new Promise((resolve, reject) => {
    const image = makeImage();
    image.onerror = () => reject(Error('Personal WebP cannot be displayed.'));
    image.onload = () => {
      try {
        if (!image.naturalWidth || !image.naturalHeight) throw Error('Personal image is empty.');
        const canvas = makeCanvas();
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw Error('Static preview is unavailable.');
        ctx.drawImage(image, 0, 0);
        const png = canvas.toDataURL('image/png');
        if (!png.startsWith('data:image/png;base64,')) throw Error('Static preview could not be created.');
        resolve(png);
      } catch (error) { reject(error); }
    };
    image.src = dataUrl;
  });
}
