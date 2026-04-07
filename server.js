import { createServer } from "node:http";
import { createRequestHandler } from "@react-router/node";

const port = process.env.PORT || 3000;

console.log(`Starting server on port ${port}`);

const handler = createRequestHandler({
  build: () => import("./build/server/index.js"),
  mode: process.env.NODE_ENV,
});

const server = createServer(async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${port}`);
});