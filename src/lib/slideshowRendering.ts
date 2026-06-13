import type {
  CanonicalSlideshowSlide,
  CanonicalSlideshowSpec,
  SlideshowTextBlock,
} from "../types";

export type SlideshowAspectRatio = "9:16" | "4:5" | "1:1";

export const SLIDESHOW_ASPECT_RATIO_OPTIONS: Array<{
  value: SlideshowAspectRatio;
  label: string;
  description: string;
}> = [
  { value: "9:16", label: "9:16", description: "TikTok, Reels, Shorts" },
  { value: "4:5", label: "4:5", description: "Portrait feed" },
  { value: "1:1", label: "1:1", description: "Square feed" },
];

export const SLIDESHOW_FONT_FAMILY =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function isSlideshowAspectRatio(value: string): value is SlideshowAspectRatio {
  return value === "9:16" || value === "4:5" || value === "1:1";
}

export function slideshowDimensionsForAspectRatio(
  aspectRatio: string | undefined
): { width: number; height: number } {
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  if (aspectRatio === "4:5") return { width: 1080, height: 1350 };
  return { width: 1080, height: 1920 };
}

export function slideshowAspectRatioForSpec(
  spec?: CanonicalSlideshowSpec
): SlideshowAspectRatio {
  const aspectRatio = spec?.aspectRatio;
  return isSlideshowAspectRatio(aspectRatio ?? "")
    ? aspectRatio as SlideshowAspectRatio
    : "9:16";
}

export function slideshowDimensionsForSpec(
  spec?: CanonicalSlideshowSpec,
  slide?: CanonicalSlideshowSlide
) {
  return spec?.dimensions ??
    slide?.dimensions ??
    slideshowDimensionsForAspectRatio(spec?.aspectRatio);
}

export function slideshowCssAspectRatio(dimensions: { width: number; height: number }) {
  return `${dimensions.width} / ${dimensions.height}`;
}

export function slideshowText(block: SlideshowTextBlock | undefined, trim = true) {
  if (!block) return "";
  const text = block.text !== undefined
    ? block.text
    : block.items?.filter(Boolean).join("\n") ?? "";
  return trim ? text.trim() : text;
}

export function hexToRgba(hex: string, alpha: number) {
  const match = hex.match(/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (!match) return hex;
  const [, red, green, blue] = match;
  return `rgba(${parseInt(red, 16)}, ${parseInt(green, 16)}, ${parseInt(blue, 16)}, ${alpha})`;
}

export function slideshowTextShadow(block: SlideshowTextBlock) {
  const strokeWidth = block.strokeWidth ?? 0;
  if (strokeWidth <= 0) return "none";
  const strokeColor = block.strokeColor ?? "#111111";
  const softShadow = `0 ${Math.max(1, strokeWidth * 0.18)}px ${Math.max(4, strokeWidth * 0.75)}px rgba(0,0,0,0.45)`;
  return [
    `${strokeWidth * 0.06}px 0 0 ${strokeColor}`,
    `-${strokeWidth * 0.06}px 0 0 ${strokeColor}`,
    `0 ${strokeWidth * 0.06}px 0 ${strokeColor}`,
    `0 -${strokeWidth * 0.06}px 0 ${strokeColor}`,
    softShadow,
  ].join(", ");
}

export function slideshowTextBlockFrame(
  block: SlideshowTextBlock,
  dimensions: { width: number; height: number }
) {
  const x = Math.max(0, Math.min(100, block.x ?? 10));
  const y = Math.max(0, Math.min(100, block.y ?? 42));
  const width = Math.max(12, Math.min(100 - x, block.width ?? 80));
  const height = Math.max(4, Math.min(100 - y, block.height ?? 10));

  return {
    x: dimensions.width * (x / 100),
    y: dimensions.height * (y / 100),
    width: dimensions.width * (width / 100),
    minHeight: dimensions.height * (height / 100),
  };
}

export function slideshowTextFontSize(block: SlideshowTextBlock, index = 0) {
  const fallback = index === 0 || block.emphasis === "primary" || block.role === "headline"
    ? 72
    : 44;
  return Math.max(20, block.fontSize ?? fallback);
}

export function slideshowTextFontWeight(block: SlideshowTextBlock, index = 0) {
  const fallback = index === 0 || block.emphasis === "primary" || block.role === "headline"
    ? 850
    : 760;
  return Math.round(block.fontWeight ?? fallback);
}

export function estimateSlideshowTextBlockHeight(
  block: SlideshowTextBlock,
  dimensions: { width: number; height: number },
  index = 0
) {
  const fontSize = slideshowTextFontSize(block, index);
  const frame = slideshowTextBlockFrame(block, dimensions);
  const averageCharacterWidth = fontSize * 0.54;
  const charactersPerLine = Math.max(1, Math.floor(frame.width / averageCharacterWidth));
  const text = slideshowText(block, false) || " ";
  const lineCount = text.split("\n").reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / charactersPerLine));
  }, 0);
  const strokeAllowance = Math.max(0, block.strokeWidth ?? 0) * 0.4;
  const contentHeightPx = lineCount * fontSize * 1.08 + fontSize * 0.16 + strokeAllowance;
  return Math.max(4, (contentHeightPx / dimensions.height) * 100);
}
