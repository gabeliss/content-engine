import { drawCoverImage, drawTextOverlays } from "../../lib/composition/canvasText";
import { dimensionsForAspectRatio } from "../../lib/composition/aspectRatios";
import {
  activeTextOverlaysAtTime,
  audioTrackEndTime,
  clipDuration,
  compositionTimelineDuration,
  mediaKindForClip,
  normalizedAudioTrim,
  type VideoCompositionDraft,
  type VideoComposerAudioTrack,
  type VideoComposerClip,
} from "./videoComposerModel";

type RenderProgress = {
  clipIndex: number;
  progress: number;
  timeSeconds: number;
};

type RenderOptions = {
  fps?: number;
  onProgress?: (progress: RenderProgress) => void;
};

function recorderMimeType() {
  const supportedTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function waitForEvent<T extends Event>(
  target: EventTarget,
  eventName: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const onEvent = (event: Event) => {
      cleanup();
      resolve(event as T);
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Unable to load media for ${eventName}`));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

async function loadVideo(clip: VideoComposerClip) {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.preload = "auto";
  video.src = clip.storageUrl;
  await waitForEvent(video, "loadedmetadata");
  return video;
}

async function loadImage(clip: VideoComposerClip) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = clip.storageUrl;
  if (!image.complete) await waitForEvent(image, "load");
  return image;
}

async function loadAudio(track: VideoComposerAudioTrack) {
  const audio = document.createElement("audio");
  audio.crossOrigin = "anonymous";
  audio.preload = "auto";
  audio.src = track.storageUrl;
  await waitForEvent(audio, "loadedmetadata");
  return audio;
}

function seekVideo(video: HTMLVideoElement, timeSeconds: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Unable to seek video"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = timeSeconds;
  });
}

function seekMedia(media: HTMLMediaElement, timeSeconds: number) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Unable to seek media"));
    };
    const cleanup = () => {
      media.removeEventListener("seeked", onSeeked);
      media.removeEventListener("error", onError);
    };
    media.addEventListener("seeked", onSeeked, { once: true });
    media.addEventListener("error", onError);
    media.currentTime = timeSeconds;
  });
}

function nextAnimationFrame() {
  return new Promise<number>((resolve) => requestAnimationFrame(resolve));
}

async function playVideo(video: HTMLVideoElement) {
  try {
    await video.play();
  } catch {
    video.muted = true;
    await video.play();
  }
}

async function playAudio(audio: HTMLAudioElement) {
  try {
    await audio.play();
  } catch {
    // Browser autoplay policy can still reject background audio; the export path
    // is always initiated by a user action or Studio auto-render page load.
  }
}

export async function renderVideoCompositionToBlob(
  draft: VideoCompositionDraft,
  options: RenderOptions = {}
) {
  if (draft.clips.length === 0) {
    throw new Error("Add at least one video clip before exporting.");
  }
  if (typeof MediaRecorder === "undefined") {
    throw new Error("This browser does not support video export.");
  }

  const fps = options.fps ?? 30;
  const dimensions = dimensionsForAspectRatio(draft.aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create video renderer.");

  const canvasStream = canvas.captureStream(fps);
  const AudioContextConstructor = window.AudioContext ||
    (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  const audioContext = AudioContextConstructor ? new AudioContextConstructor() : undefined;
  const audioDestination = audioContext?.createMediaStreamDestination();
  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(audioDestination?.stream.getAudioTracks() ?? []),
  ]);
  const chunks: Blob[] = [];
  const mimeType = recorderMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  let totalDuration = compositionTimelineDuration(draft.clips, draft.audioTracks ?? []);

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  const completed = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener("stop", () => {
      resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
    }, { once: true });
    recorder.addEventListener("error", () => {
      reject(new Error("Video export failed."));
    }, { once: true });
  });

  if (audioContext?.state === "suspended") {
    await audioContext.resume();
  }
  const audioEntries = audioContext && audioDestination
    ? await Promise.all(
        (draft.audioTracks ?? []).map(async (track) => {
          const audio = await loadAudio(track);
          const source = audioContext.createMediaElementSource(audio);
          const gain = audioContext.createGain();
          gain.gain.value = Math.max(0, Math.min(1, track.volume ?? 1));
          source.connect(gain);
          gain.connect(audioDestination);
          audio.volume = Math.max(0, Math.min(1, track.volume ?? 1));
          audio.pause();
          return {
            audio,
            source,
            gain,
            track,
            trim: normalizedAudioTrim({
              ...track,
              durationSeconds: track.durationSeconds ?? audio.duration,
            }),
          };
        })
      )
    : [];

  const syncAudioTracks = (globalTime: number) => {
    for (const entry of audioEntries) {
      const trackStart = Math.max(0, entry.track.startSeconds);
      const trackEnd = audioTrackEndTime({
        ...entry.track,
        durationSeconds: entry.track.durationSeconds ?? entry.audio.duration,
      });
      const isActive = globalTime >= trackStart && globalTime <= trackEnd;
      if (!isActive) {
        entry.audio.pause();
        continue;
      }

      const sourceTime = entry.trim.startSeconds + (globalTime - trackStart);
      if (Math.abs(entry.audio.currentTime - sourceTime) > 0.16) {
        void seekMedia(entry.audio, sourceTime).catch(() => undefined);
      }
      if (entry.audio.paused) void playAudio(entry.audio);
    }
  };
  totalDuration = Math.max(
    totalDuration,
    ...audioEntries.map((entry) =>
      audioTrackEndTime({
        ...entry.track,
        durationSeconds: entry.track.durationSeconds ?? entry.audio.duration,
      })
    )
  );

  recorder.start(250);

  let timelineCursor = 0;
  for (let clipIndex = 0; clipIndex < draft.clips.length; clipIndex += 1) {
    const clip = draft.clips[clipIndex];
    if (mediaKindForClip(clip) === "image") {
      const image = await loadImage(clip);
      const targetDuration = clipDuration(clip);
      if (targetDuration <= 0) continue;
      const clipStartMs = performance.now();

      while (performance.now() - clipStartMs < targetDuration * 1000) {
        const elapsedSeconds = (performance.now() - clipStartMs) / 1000;
        const localTime = Math.min(targetDuration, elapsedSeconds);
        const globalTime = timelineCursor + localTime;
        ctx.fillStyle = "#111513";
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);
        drawCoverImage(ctx, image, dimensions.width, dimensions.height);
        drawTextOverlays(
          ctx,
          activeTextOverlaysAtTime(draft.textOverlays, globalTime, totalDuration),
          dimensions
        );
        syncAudioTracks(globalTime);
        options.onProgress?.({
          clipIndex,
          progress: totalDuration ? Math.min(1, globalTime / totalDuration) : 0,
          timeSeconds: globalTime,
        });
        await nextAnimationFrame();
      }

      timelineCursor += targetDuration;
      continue;
    }

    const video = await loadVideo(clip);
    const source = audioContext && audioDestination
      ? audioContext.createMediaElementSource(video)
      : undefined;
    source?.connect(audioDestination!);

    const trimStart = Math.min(clip.trimStartSeconds, Math.max(0, video.duration - 0.05));
    const trimEnd = Math.min(clip.trimEndSeconds ?? video.duration, video.duration);
    const targetDuration = Math.max(0, trimEnd - trimStart);
    if (targetDuration <= 0) continue;

    await seekVideo(video, trimStart);
    await playVideo(video);

    while (!video.ended && video.currentTime < trimEnd) {
      const localTime = Math.min(targetDuration, video.currentTime - trimStart);
      const globalTime = timelineCursor + localTime;
      ctx.fillStyle = "#111513";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      drawCoverImage(ctx, video, dimensions.width, dimensions.height);
      drawTextOverlays(
        ctx,
        activeTextOverlaysAtTime(draft.textOverlays, globalTime, totalDuration),
        dimensions
      );
      syncAudioTracks(globalTime);
      options.onProgress?.({
        clipIndex,
        progress: totalDuration ? Math.min(1, globalTime / totalDuration) : 0,
        timeSeconds: globalTime,
      });
      await nextAnimationFrame();
    }

    video.pause();
    source?.disconnect();
    timelineCursor += clipDuration({
      ...clip,
      durationSeconds: video.duration,
      trimEndSeconds: trimEnd,
    });
  }

  if (timelineCursor < totalDuration) {
    const tailStartMs = performance.now();
    const tailDuration = totalDuration - timelineCursor;
    while (performance.now() - tailStartMs < tailDuration * 1000) {
      const elapsedSeconds = (performance.now() - tailStartMs) / 1000;
      const globalTime = Math.min(totalDuration, timelineCursor + elapsedSeconds);
      ctx.fillStyle = "#111513";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      drawTextOverlays(
        ctx,
        activeTextOverlaysAtTime(draft.textOverlays, globalTime, totalDuration),
        dimensions
      );
      syncAudioTracks(globalTime);
      options.onProgress?.({
        clipIndex: draft.clips.length,
        progress: totalDuration ? Math.min(1, globalTime / totalDuration) : 0,
        timeSeconds: globalTime,
      });
      await nextAnimationFrame();
    }
  }

  audioEntries.forEach((entry) => {
    entry.audio.pause();
    entry.source.disconnect();
    entry.gain.disconnect();
  });
  recorder.stop();
  canvasStream.getTracks().forEach((track) => track.stop());
  await audioContext?.close();
  return await completed;
}
