import { httpRouter } from "convex/server";
import { renderProgressHttp } from "../create/studioRenderRequests";
import { mcpHttp } from "../mcp/http";

const http = httpRouter();

// Provider webhooks will live here once Postiz and Post Bridge adapters need
// inbound status or account updates.
http.route({
  path: "/mcp",
  method: "POST",
  handler: mcpHttp,
});

http.route({
  path: "/mcp",
  method: "GET",
  handler: mcpHttp,
});

http.route({
  path: "/mcp",
  method: "OPTIONS",
  handler: mcpHttp,
});

http.route({
  path: "/studio-render/progress",
  method: "POST",
  handler: renderProgressHttp,
});

export default http;
