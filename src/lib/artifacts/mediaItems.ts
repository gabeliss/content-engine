export type ArtifactLikeWithData = {
  data?: unknown;
  storageUrl?: string;
  type?: string;
};

export type PackageMediaItem = {
  artifactId?: string;
  artifactType?: string;
  mimeType?: string;
  model?: string;
  provider?: string;
  role?: string;
  storageUrl?: string;
  title?: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function mediaItemsForArtifact(artifact: ArtifactLikeWithData): PackageMediaItem[] {
  if (!isRecord(artifact.data) || !Array.isArray(artifact.data.mediaItems)) return [];

  return artifact.data.mediaItems
    .filter(isRecord)
    .map((item) => ({
      artifactId: typeof item.artifactId === "string" ? item.artifactId : undefined,
      artifactType: typeof item.artifactType === "string" ? item.artifactType : undefined,
      mimeType: typeof item.mimeType === "string" ? item.mimeType : undefined,
      model: typeof item.model === "string" ? item.model : undefined,
      provider: typeof item.provider === "string" ? item.provider : undefined,
      role: typeof item.role === "string" ? item.role : undefined,
      storageUrl: typeof item.storageUrl === "string" ? item.storageUrl : undefined,
      title: typeof item.title === "string" ? item.title : undefined,
    }));
}

export function artifactStorageUrl(artifact: ArtifactLikeWithData): string | undefined {
  if (typeof artifact.storageUrl === "string") return artifact.storageUrl;
  if (isRecord(artifact.data) && typeof artifact.data.url === "string") return artifact.data.url;
  return undefined;
}

export function artifactDataMimeType(artifact: ArtifactLikeWithData): string | undefined {
  return isRecord(artifact.data) && typeof artifact.data.mimeType === "string"
    ? artifact.data.mimeType
    : undefined;
}
