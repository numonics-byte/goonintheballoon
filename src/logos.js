import * as THREE from 'three';

// Loads a rival/player studio logo as a texture. Logos with a white background
// (jpg) get the white keyed out to transparency so they read as decals.
export function loadLogoTexture(url, keyWhite = false) {
  if (!keyWhite) {
    const t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const tex = new THREE.Texture();
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const a = data.data;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] > 240 && a[i + 1] > 240 && a[i + 2] > 240) a[i + 3] = 0;
    }
    ctx.putImageData(data, 0, 0);
    tex.image = c;
    tex.needsUpdate = true;
  };
  img.src = url;
  return tex;
}

// Studio logo set. Player flies under Reality Kings (matches the title art),
// rivals carry Bang Bros, Dog Fart and Brazzers.
export const LOGOS = {
  rk: () => loadLogoTexture('/logos/RK_logo.jpg', true),
  bb: () => loadLogoTexture('/logos/BB_logo.png'),
  df: () => loadLogoTexture('/logos/DF_logo.png'),
  brazz: () => loadLogoTexture('/logos/Brazz_logo.png', true),
};
