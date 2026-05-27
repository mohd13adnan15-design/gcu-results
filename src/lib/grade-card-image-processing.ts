/** Canvas helpers for grade-card PNG assets (seal, signatures). */

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function removeLightBackground(source: string): Promise<string> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(source);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        const isNearWhite = max > 190 && min > 178 && diff < 35;
        const isLightPaper = max > 160 && min > 148 && diff < 28;
        const isLightGray = max > 145 && min > 132 && diff < 24;
        if (isNearWhite || isLightPaper || isLightGray) {
          data[i + 3] = 0;
        }
      }
      ctx.putImageData(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(source);
    img.src = source;
  });
}

export async function loadTransparentAsset(
  url: string,
  options: { dropLightBackground?: boolean } = {},
): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    let dataUrl = await blobToDataUrl(blob);
    if (options.dropLightBackground !== false) {
      dataUrl = await removeLightBackground(dataUrl);
    }
    return dataUrl;
  } catch {
    return null;
  }
}

function isLogoContentPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 20) return false;
  return !(r > 244 && g > 244 && b > 244);
}

/** Trim empty margins from the GCU logo so "CITY" is not pushed off the right edge. */
export async function trimLogoToContentBounds(source: string): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ dataUrl: source, width: img.width, height: img.height });
        return;
      }
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (!isLogoContentPixel(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }

      if (maxX <= minX || maxY <= minY) {
        resolve({ dataUrl: source, width: img.width, height: img.height });
        return;
      }

      const pad = 4;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(width - 1, maxX + pad);
      maxY = Math.min(height - 1, maxY + pad);
      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;

      const out = document.createElement("canvas");
      out.width = cropW;
      out.height = cropH;
      out.getContext("2d")!.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      resolve({ dataUrl: out.toDataURL("image/png"), width: cropW, height: cropH });
    };
    img.onerror = () => resolve({ dataUrl: source, width: 0, height: 0 });
    img.src = source;
  });
}

export async function prepareGradeCardLogo(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    return await trimLogoToContentBounds(dataUrl);
  } catch {
    return null;
  }
}
