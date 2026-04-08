import * as build from "./build/server/index.js";
import { createServer } from "node:http";

const port = process.env.PORT || 3000;

console.log(`Starting server on port ${port}`);

// Dynamically import react-router's handler
const { createRequestHandler } = await import("react-router");

const handler = createRequestHandler({ build, mode: process.env.NODE_ENV });

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
  console.log(`✅ Server listening on http://0.0.0.0:${port}`);
});