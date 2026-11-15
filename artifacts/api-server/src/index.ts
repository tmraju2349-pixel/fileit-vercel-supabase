import app from "./app.js";
import { logger } from "./lib/logger.js";
import { cleanupExpiredFilesAndFolders } from "./cleanup.js";

export default app;

// Vercel imports this module as a serverless handler. Only start a persistent
// listener when running locally or on a traditional service such as Render.
if (!process.env.VERCEL) {
  const rawPort = process.env["PORT"] || "3000";
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const server = app.listen(port, "0.0.0.0", () => {
    logger.info({ port, host: "0.0.0.0" }, "Server listening and ready for requests");

    // Run cleanup every hour safely on persistent deployments.
    const cleanupInterval = setInterval(() => {
      logger.info("Running cleanup for expired files and folders...");
      cleanupExpiredFilesAndFolders().catch((err: unknown) => {
        logger.error({ err }, "Periodic cleanup error");
      });
    }, 60 * 60 * 1000);

    cleanupInterval.unref();
  });

  server.on("error", (err: any) => {
    logger.error({ err }, "Server listen error encountered");
    if (err?.code === "EADDRINUSE") {
      logger.warn({ port }, "Port already in use; exiting duplicate server instance");
      process.exit(0);
    }
  });

  // Handle graceful shutdown signals for local/Render execution.
  process.on("SIGTERM", () => {
    logger.info("SIGTERM signal received: closing HTTP server");
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    logger.info("SIGINT signal received: closing HTTP server");
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  });
}
