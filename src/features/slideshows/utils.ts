import {
  TEXT_STYLES,
  DEFAULT_CONFIG,
  EXPORT_BASE_SIZE,
  getDimensions,
} from "./styles";

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function sanitizeForFilename(text: string): string {
  return text.replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

export function extractSlideCountFromPrompt(prompt: string): number {
  const slideCountMatch = prompt.match(/(\d+)\s+slides?/i);
  return slideCountMatch ? parseInt(slideCountMatch[1]) : 5;
}

export function clampSlideCount(count: number): number {
  return Math.max(3, Math.min(10, count));
}

// Canvas rendering for slide export
interface SlideData {
  text: string;
  imageUrl: string;
  overlay?: boolean;
}

interface ConfigData {
  fontSize?: number;
  aspectRatio?: string;
  textPosition?: { x: number; y: number };
}

export async function renderSlideToCanvas(
  slide: SlideData,
  config: ConfigData
): Promise<Blob> {
  const fontSize = config.fontSize || DEFAULT_CONFIG.fontSize;
  const aspectRatio = config.aspectRatio || DEFAULT_CONFIG.aspectRatio;
  const textPosition = config.textPosition || DEFAULT_CONFIG.textPosition;

  // Get canvas dimensions
  const { width, height } = getDimensions(aspectRatio, EXPORT_BASE_SIZE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Load and draw background image
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = slide.imageUrl;
  });

  // Draw image to cover canvas (center crop)
  const imgRatio = img.width / img.height;
  const canvasRatio = width / height;
  let drawWidth, drawHeight, drawX, drawY;

  if (imgRatio > canvasRatio) {
    drawHeight = height;
    drawWidth = img.width * (height / img.height);
    drawX = (width - drawWidth) / 2;
    drawY = 0;
  } else {
    drawWidth = width;
    drawHeight = img.height * (width / img.width);
    drawX = 0;
    drawY = (height - drawHeight) / 2;
  }

  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

  // Draw overlay if enabled
  if (slide.overlay) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, width, height);
  }

  // Draw text if present
  if (slide.text) {
    ctx.font = TEXT_STYLES.getCanvasFont(fontSize);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Word wrap text
    const maxWidth = width * TEXT_STYLES.maxWidthPercent;
    const lineHeight = fontSize * TEXT_STYLES.lineHeight;
    const words = slide.text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Calculate text position based on config percentages
    const centerX = (textPosition.x / 100) * width;
    const centerY = (textPosition.y / 100) * height;

    // Adjust startY so text block is centered at the position
    const totalHeight = lines.length * lineHeight;
    const startY = centerY - totalHeight / 2 + lineHeight / 2;

    // Text stroke offset (using shared calculation)
    const strokeOffset = TEXT_STYLES.getStrokeOffset(width);

    // Draw each line with 4-corner stroke effect (matching CSS text-shadow)
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight;

      // Draw black stroke (4 corners to create outline effect)
      ctx.fillStyle = TEXT_STYLES.strokeColor;
      ctx.fillText(line, centerX - strokeOffset, y - strokeOffset); // top-left
      ctx.fillText(line, centerX + strokeOffset, y - strokeOffset); // top-right
      ctx.fillText(line, centerX - strokeOffset, y + strokeOffset); // bottom-left
      ctx.fillText(line, centerX + strokeOffset, y + strokeOffset); // bottom-right

      // Draw white text on top
      ctx.fillStyle = TEXT_STYLES.color;
      ctx.fillText(line, centerX, y);
    });
  }

  // Convert canvas to blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), "image/png");
  });
}
