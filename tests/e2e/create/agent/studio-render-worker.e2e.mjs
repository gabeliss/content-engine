import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  createProgressReporter,
  handleRenderWorkerRequest,
} from "../../../../services/studio-render-worker/server.mjs";

function request({ body, headers = {}, method, url }) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const req = Readable.from(chunks);
  req.headers = headers;
  req.method = method;
  req.url = url;
  return req;
}

function response() {
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const res = {
    body: Buffer.alloc(0),
    headers: {},
    statusCode: 0,
    writeHead(statusCode, headers) {
      res.statusCode = statusCode;
      res.headers = headers ?? {};
    },
    end(payload = Buffer.alloc(0)) {
      res.body = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
      resolveDone(res);
    },
  };
  res.done = done;
  return res;
}

async function invokeHandler(options, handlerOptions) {
  const res = response();
  await handleRenderWorkerRequest(request(options), res, handlerOptions);
  return await res.done;
}

const health = await invokeHandler({ method: "GET", url: "/health" });
assert.equal(health.statusCode, 200);
assert.equal(JSON.parse(health.body.toString("utf8")).status, "ok");

let renderCalls = 0;
const unauthorized = await invokeHandler(
  {
    body: { draft: { clips: [] } },
    method: "POST",
    url: "/render",
  },
  {
    render: async () => {
      renderCalls += 1;
      return Buffer.from("not-called");
    },
    workerApiKey: "secret",
  }
);
assert.equal(unauthorized.statusCode, 401);
assert.equal(renderCalls, 0);

let receivedBody;
const rendered = await invokeHandler(
  {
    body: { draft: { clips: [] }, fps: 24 },
    headers: { authorization: "Bearer secret" },
    method: "POST",
    url: "/render",
  },
  {
    render: async (body) => {
      receivedBody = body;
      return Buffer.from("fake-mp4");
    },
    workerApiKey: "secret",
  }
);
assert.equal(rendered.statusCode, 200);
assert.equal(rendered.headers["content-type"], "video/mp4");
assert.equal(rendered.headers["content-length"], Buffer.byteLength("fake-mp4"));
assert.equal(rendered.body.toString("utf8"), "fake-mp4");
assert.deepEqual(receivedBody, { draft: { clips: [] }, fps: 24 });

const originalConsoleError = console.error;
console.error = () => {};
let failed;
try {
  failed = await invokeHandler(
    {
      body: { draft: { clips: [] } },
      method: "POST",
      url: "/render",
    },
    {
      render: async () => {
        throw new Error("boom");
      },
    }
  );
} finally {
  console.error = originalConsoleError;
}
assert.equal(failed.statusCode, 500);
assert.equal(JSON.parse(failed.body.toString("utf8")).error, "boom");

const originalFetch = globalThis.fetch;
const progressCalls = [];
globalThis.fetch = async (url, init) => {
  progressCalls.push({
    body: JSON.parse(init.body),
    headers: init.headers,
    method: init.method,
    url,
  });
  return new Response("ok", { status: 200 });
};

try {
  const reportProgress = createProgressReporter({
    progressCallbackApiKey: "callback-secret",
    progressCallbackUrl: "https://example.com/studio-render/progress",
    renderRequestId: "render_123",
  });

  assert.equal(await reportProgress(0.01, "Starting"), true);
  assert.equal(await reportProgress(0.03, "Too soon"), false);
  assert.equal(await reportProgress(0.07, "Rendering"), true);
  assert.equal(await reportProgress(1, "Finalizing"), true);
} finally {
  globalThis.fetch = originalFetch;
}

assert.equal(progressCalls.length, 3);
assert.deepEqual(
  progressCalls.map((call) => call.body),
  [
    { requestId: "render_123", progress: 0.01, message: "Starting" },
    { requestId: "render_123", progress: 0.07, message: "Rendering" },
    { requestId: "render_123", progress: 0.999, message: "Finalizing" },
  ]
);
assert.equal(progressCalls[0].headers.authorization, "Bearer callback-secret");

console.log("Studio render worker contract passed");
