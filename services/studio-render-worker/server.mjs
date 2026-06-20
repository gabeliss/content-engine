import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const entryPoint = path.join(
  repoRoot,
  "src/features/video-composer/remotion/entry.tsx"
);
const compositionId = "StudioComposition";
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST ||
  (process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1");
const apiKey = process.env.STUDIO_RENDER_WORKER_API_KEY;

let serveUrlPromise;

function jsonResponse(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-length": Buffer.byteLength(payload),
    "content-type": "application/json",
  });
  res.end(payload);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function bundledServeUrl() {
  if (!serveUrlPromise) {
    serveUrlPromise = bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });
  }
  return await serveUrlPromise;
}

export async function warmRenderBrowser() {
  const status = await ensureBrowser({
    chromeMode: "headless-shell",
    logLevel: "info",
    onBrowserDownload: ({ chromeMode }) => ({
      version: null,
      onProgress: ({ alreadyAvailable, percent }) => {
        if (alreadyAvailable) return;
        const roundedPercent = Math.round(percent * 100);
        if (roundedPercent % 10 === 0) {
          console.log(`Downloading ${chromeMode} ${roundedPercent}%`);
        }
      },
    }),
  });
  if (status.type === "no-browser") {
    throw new Error("Remotion could not find or download a browser.");
  }
  if (status.type === "version-mismatch") {
    throw new Error(
      `Remotion browser version mismatch: expected compatible browser, found ${status.actualVersion ?? "unknown"}.`
    );
  }
  console.log(`Remotion browser ready: ${status.path}`);
  return status;
}

export function createProgressReporter({
  progressCallbackApiKey,
  progressCallbackUrl,
  renderRequestId,
}) {
  let lastReportedProgress = -1;

  return async function reportProgress(progress, message) {
    if (!progressCallbackUrl || !renderRequestId) return false;
    const roundedProgress = Math.max(
      0,
      Math.min(0.999, Math.round(progress * 100) / 100)
    );
    if (roundedProgress < 0.999 && roundedProgress - lastReportedProgress < 0.05) {
      return false;
    }
    lastReportedProgress = roundedProgress;
    const headers = { "content-type": "application/json" };
    if (progressCallbackApiKey) headers.authorization = `Bearer ${progressCallbackApiKey}`;
    try {
      await fetch(progressCallbackUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          requestId: renderRequestId,
          progress: roundedProgress,
          message,
        }),
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.warn(`Could not report render progress: ${message}`);
      return false;
    }
  };
}

export async function renderStudioComposition(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Render request body must be an object.");
  }
  const draft = body.draft;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    throw new Error("Render request requires a draft object.");
  }

  const fps = typeof body.fps === "number" && Number.isFinite(body.fps)
    ? body.fps
    : 30;
  const progressCallbackUrl = typeof body.progressCallbackUrl === "string"
    ? body.progressCallbackUrl
    : undefined;
  const progressCallbackApiKey = typeof body.progressCallbackApiKey === "string"
    ? body.progressCallbackApiKey
    : undefined;
  const renderRequestId = typeof body.renderRequestId === "string"
    ? body.renderRequestId
    : undefined;
  const reportProgress = createProgressReporter({
    progressCallbackApiKey,
    progressCallbackUrl,
    renderRequestId,
  });
  const inputProps = { draft, fps };
  const serveUrl = await bundledServeUrl();
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
  });
  const directory = await mkdtemp(path.join(tmpdir(), "content-engine-render-"));
  const outputLocation = path.join(directory, "studio-render.mp4");

  try {
    await reportProgress(0.01, "Starting render");
    await renderMedia({
      codec: "h264",
      composition,
      inputProps,
      outputLocation,
      serveUrl,
      onProgress: ({ progress }) => {
        const percent = Math.round(progress * 100);
        void reportProgress(progress, `Rendering ${percent}%`);
        if (percent % 10 === 0) {
          console.log(`Render ${percent}% complete`);
        }
      },
    });
    await reportProgress(0.999, "Finalizing");
    const bytes = await readFile(outputLocation);
    return bytes;
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

export async function handleRenderWorkerRequest(req, res, {
  render = renderStudioComposition,
  workerApiKey = apiKey,
} = {}) {
  try {
    if (req.method === "GET" && req.url === "/health") {
      jsonResponse(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "POST" && req.url === "/render") {
      if (workerApiKey && req.headers.authorization !== `Bearer ${workerApiKey}`) {
        jsonResponse(res, 401, { error: "Invalid render worker API key" });
        return;
      }
      const body = await readJsonBody(req);
      const startedAt = Date.now();
      const bytes = await render(body);
      res.writeHead(200, {
        "content-disposition": 'attachment; filename="studio-render.mp4"',
        "content-length": bytes.byteLength,
        "content-type": "video/mp4",
        "x-render-duration-ms": String(Date.now() - startedAt),
      });
      res.end(bytes);
      return;
    }

    jsonResponse(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    jsonResponse(res, 500, {
      error: error instanceof Error ? error.message : "Render failed",
    });
  }
}

export function createRenderWorkerServer(options = {}) {
  return createServer(async (req, res) => {
    await handleRenderWorkerRequest(req, res, options);
  });
}

export async function startRenderWorkerServer() {
  try {
    await warmRenderBrowser();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.warn(`Remotion browser warmup failed; first render will retry: ${message}`);
  }

  const server = createRenderWorkerServer();
  server.listen(port, host, () => {
    console.log(`Studio render worker listening on ${host}:${port}`);
  });
  return server;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  startRenderWorkerServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
