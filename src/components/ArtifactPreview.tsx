import { useState } from "react";
import type { ArtifactDoc } from "../types";
import { MediaLightbox, type MediaLightboxItem } from "./MediaLightbox";

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
  const [lightboxImage, setLightboxImage] = useState<MediaLightboxItem | null>(null);
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
    const title = artifact.title || "Generated image";
    return (
      <>
        <button
          aria-label={`View ${title}`}
          className="artifact-preview image-preview library-media-preview block w-full cursor-zoom-in border-0 bg-transparent p-0 text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          onClick={() => {
            setLightboxImage({
              src: imageUrl,
              title,
              meta: [artifact.provider, artifact.model].filter(Boolean).join(" · "),
            });
          }}
          style={aspectRatio ? { aspectRatio } : undefined}
          type="button"
        >
          <img src={imageUrl} alt={title} />
        </button>
        <MediaLightbox media={lightboxImage} onClose={() => setLightboxImage(null)} />
      </>
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
