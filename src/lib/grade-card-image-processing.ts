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
