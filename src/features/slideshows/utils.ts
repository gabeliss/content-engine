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
