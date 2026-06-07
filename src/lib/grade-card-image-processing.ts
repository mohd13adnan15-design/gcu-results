/** Canvas helpers for grade-card PNG assets (seal, signatures). */

/** Encode path segments so fetch/img work with spaces in public asset filenames. */
export function encodePublicAssetUrl(path: string): string {
  const queryIndex = path.indexOf("?");
  const base = queryIndex >= 0 ? path.slice(0, queryIndex) : path;
  const query = queryIndex >= 0 ? path.slice(queryIndex) : "";
  return (
    base
      .split("/")
      .map((segment, index) => (index === 0 || segment === "" ? segment : encodeURIComponent(segment)))
      .join("/") + query
  );
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function isGoldLogoPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 95) return false;
  if (min > 210 && max - min < 30) return false;
  if (max - min < 15 && max > 170 && max < 230) return false;
  return r > 105 && g > 75 && b < 195 && r >= g - 15;
}

function shouldDropLogoMattePixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 40) return true;
  if (isGoldLogoPixel(r, g, b)) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  const isNearWhite = max > 235 && min > 225;
  const isLightGray = diff < 20 && max > 160 && max < 230;
  const isCheckerGray = diff < 12 && max > 180 && max < 210;
  const isNeutralMatte =
    diff < 18 &&
    max > 110 &&
    max < 250 &&
    Math.abs(r - g) < 20 &&
    Math.abs(g - b) < 20;
  return isNearWhite || isLightGray || isCheckerGray || isNeutralMatte;
}

function clearTransparentPixel(data: Uint8ClampedArray, index: number) {
  data[index] = 0;
  data[index + 1] = 0;
  data[index + 2] = 0;
  data[index + 3] = 0;
}

/** Remove gray/white PNG matte so the grade-card guilloche background shows through. */
export async function removeLogoMatteBackground(source: string): Promise<string> {
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
        const a = data[i + 3];
        if (shouldDropLogoMattePixel(r, g, b, a)) {
          clearTransparentPixel(data, i);
        } else if (a === 0) {
          clearTransparentPixel(data, i);
        }
      }
      ctx.putImageData(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(source);
    img.src = source;
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
    const response = await fetch(encodePublicAssetUrl(url));
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
  if (a < 40) return false;
  return isGoldLogoPixel(r, g, b);
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
    const response = await fetch(encodePublicAssetUrl(url));
    if (!response.ok) return null;
    const blob = await response.blob();
    let dataUrl = await blobToDataUrl(blob);
    dataUrl = await removeLogoMatteBackground(dataUrl);
    return await trimLogoToContentBounds(dataUrl);
  } catch {
    return null;
  }
}

async function trimImageEdges(source: string, trimPx: number): Promise<string> {
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
      const t = Math.min(trimPx, Math.floor(img.width / 6), Math.floor(img.height / 6));
      const sw = Math.max(1, img.width - t * 2);
      const sh = Math.max(1, img.height - t * 2);
      ctx.drawImage(img, t, t, sw, sh, 0, 0, img.width, img.height);
      const edgeClear = 2;
      ctx.clearRect(0, 0, img.width, edgeClear);
      ctx.clearRect(0, img.height - edgeClear, img.width, edgeClear);
      ctx.clearRect(0, 0, edgeClear, img.height);
      ctx.clearRect(img.width - edgeClear, 0, edgeClear, img.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(source);
    img.src = source;
  });
}

/** Match PDF student photo processing: trim scan margins and drop light backgrounds. */
export async function prepareGradeCardStudentPhoto(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    let dataUrl = await blobToDataUrl(await response.blob());
    dataUrl = await trimImageEdges(dataUrl, 18);
    dataUrl = await removeLightBackground(dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}
