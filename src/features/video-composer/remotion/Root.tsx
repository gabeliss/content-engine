import { Composition } from "remotion";
import { createEmptyVideoCompositionDraft } from "../videoComposerModel";
import {
  STUDIO_REMOTION_COMPOSITION_ID,
  STUDIO_REMOTION_DEFAULT_FPS,
  StudioComposition,
  studioCompositionDimensions,
  studioCompositionDurationInFrames,
  type StudioCompositionProps,
} from "./StudioComposition";

const defaultDraft = createEmptyVideoCompositionDraft();
const defaultDimensions = studioCompositionDimensions(defaultDraft);

export function RemotionRoot() {
  return (
    <Composition
      id={STUDIO_REMOTION_COMPOSITION_ID}
      component={StudioComposition}
      defaultProps={{
        draft: defaultDraft,
        fps: STUDIO_REMOTION_DEFAULT_FPS,
      } satisfies StudioCompositionProps}
      durationInFrames={studioCompositionDurationInFrames(defaultDraft)}
      fps={STUDIO_REMOTION_DEFAULT_FPS}
      width={defaultDimensions.width}
      height={defaultDimensions.height}
      calculateMetadata={({ props }) => {
        const fps = props.fps ?? STUDIO_REMOTION_DEFAULT_FPS;
        const dimensions = studioCompositionDimensions(props.draft);
        return {
          durationInFrames: studioCompositionDurationInFrames(props.draft, fps),
          fps,
          width: dimensions.width,
          height: dimensions.height,
        };
      }}
    />
  );
}
