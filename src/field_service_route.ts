import { createServer } from "node:http";
import { ZodError } from "zod";
import { dispatchRequestSchema, dispatchWorkOrder } from "./dispatch_work_order.js";
import { InfraiError } from "./infrai_client.js";

const port = Number(process.env.PORT ?? 3000);

function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/dispatch") {
    response.writeHead(404).end(JSON.stringify({ error: "Route not found" }));
    return;
  }

  try {
    const body = dispatchRequestSchema.parse(await readJson(request));
    const result = await dispatchWorkOrder(body);
    response.writeHead(202).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      response.writeHead(400).end(JSON.stringify({ error: "Invalid dispatch request" }));
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.code }));
      return;
    }
    response.writeHead(500).end(JSON.stringify({ error: "Dispatch could not be submitted" }));
  }
}).listen(port, () => {
  console.log(`Field-service route listening on http://localhost:${port}`);
});
