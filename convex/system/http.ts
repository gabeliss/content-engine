import { httpRouter } from "convex/server";
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

export default http;
