import type { ArtifactDoc } from "../types";

function previewAspectRatio(artifact: ArtifactDoc) {
  const data = artifact.data && typeof artifact.data === "object"
    ? (artifact.data as Record<string, unknown>)
    : {};

  if (typeof data.aspectRatio === "string") return data.aspectRatio.replace(":", " / ");

  const dimensions = data.dimensions && typeof data.dimensions === "object"
    ? (data.dimensions as Record<string, unknown>)
    : data;
  const width = typeof dimensions.width === "number" ? dimensions.width : undefined;
  const height = typeof dimensions.height === "number" ? dimensions.height : undefined;
  return width && height ? `${width} / ${height}` : undefined;
}

export function ArtifactPreview({ artifact }: { artifact: ArtifactDoc }) {
  const data = artifact.data && typeof artifact.data === "object"
    ? (artifact.data as Record<string, unknown>)
    : {};
  const imageUrl =
    typeof artifact.storageUrl === "string"
      ? artifact.storageUrl
      : typeof data.url === "string"
        ? data.url
        : undefined;

  if (
    (artifact.type === "image" ||
      artifact.type === "rendered_asset" ||
      artifact.type === "thumbnail") &&
    imageUrl
  ) {
    const aspectRatio = previewAspectRatio(artifact);
    return (
      <div
        className="artifact-preview image-preview library-media-preview"
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        <img src={imageUrl} alt={artifact.title || "Generated image"} />
      </div>
    );
  }

  if (artifact.type === "slide_spec" && artifact.data && typeof artifact.data === "object") {
    const spec = artifact.data as {
      hook?: string;
      slides?: Array<{ headline?: string; body?: string }>;
    };
    return (
      <div className="artifact-preview spec-preview">
        <strong>{spec.hook || "Slide spec"}</strong>
        {spec.slides?.slice(0, 3).map((slide, index) => (
          <span key={`${slide.headline ?? "slide"}-${index}`}>
            {slide.headline || slide.body || `Slide ${index + 1}`}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="artifact-preview text-preview">
      <span>{artifact.type}</span>
      <strong>{artifact.title || "Artifact"}</strong>
    </div>
  );
}
