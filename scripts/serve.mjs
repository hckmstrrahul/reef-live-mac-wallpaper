import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
await import("./build.mjs");
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = path.resolve(
        "dist",
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(path.resolve("dist") + path.sep))
        throw Error("path");
      const data = await readFile(file);
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".html")
            ? "text/html"
            : "application/octet-stream",
      );
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(4187, "127.0.0.1", () =>
    console.log("Reef preview: http://127.0.0.1:4187"),
  );
