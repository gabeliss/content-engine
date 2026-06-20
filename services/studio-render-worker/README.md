# Studio Render Worker

Railway-ready Node service for rendering Content Engine Studio compositions with
Remotion.

The worker consumes the same `VideoCompositionDraft` shape edited by the Studio
UI and used by the Create agent. It renders an MP4 with Remotion and streams the
result back to the caller.

The Docker image pre-downloads Remotion's `headless-shell` browser at build
time, and the service warms/verifies that browser again on startup. If startup
warmup fails, the process stays alive and the first render retries browser
resolution so Railway can still recover from transient download/cache issues.

## HTTP API

```http
GET /health
POST /render
```

`POST /render`:

```json
{
  "draft": {
    "aspectRatio": "9:16",
    "clips": [],
    "audioTracks": [],
    "textOverlays": []
  },
  "fps": 30
}
```

Response:

```http
200 OK
Content-Type: video/mp4
```

Set `STUDIO_RENDER_WORKER_API_KEY` in Railway and Convex. Convex should send it
as:

```text
Authorization: Bearer ${STUDIO_RENDER_WORKER_API_KEY}
```

When Convex passes `progressCallbackUrl` and `progressCallbackApiKey`, the
worker reports throttled render progress to that callback during rendering.
The Content Engine Convex HTTP route is:

```text
POST /studio-render/progress
```

## Railway Deployment

This service must be built from the repository root so the Docker image can copy
the shared `src/features/video-composer/remotion/` composition code.

The root `railway.json` points Railway at the Dockerfile at:

```text
services/studio-render-worker/Dockerfile
```

Deploy from the repository root:

```bash
railway up --service studio-render-worker
```

Do not deploy with `services/studio-render-worker` as the path-as-root unless
the shared Remotion composition has first been packaged or copied into the
service.

Required Railway env vars:

```text
STUDIO_RENDER_WORKER_API_KEY=<shared-secret>
```

The Docker build downloads a browser, so the first deployment may take longer
than a normal Node service image build.

Convex env vars for the next integration step:

```text
STUDIO_RENDER_WORKER_URL=https://<worker>.up.railway.app
STUDIO_RENDER_WORKER_API_KEY=<shared-secret>
STUDIO_RENDER_CALLBACK_URL=https://<convex-site>.convex.site
STUDIO_RENDER_CALLBACK_API_KEY=<shared-secret>
```
