import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

console.log("Starting Fileit API Server (port 3001) and Frontend (port 3000)...");

const apiServer = spawn(npmCmd, ["run", "dev"], {
  cwd: path.resolve(__dirname, "artifacts/api-server"),
  env: { ...process.env, PORT: "3001", NODE_ENV: "development" },
  stdio: "inherit",
  shell: true,
});

const frontend = spawn(npmCmd, ["run", "dev"], {
  cwd: path.resolve(__dirname, "artifacts/fileit"),
  env: { ...process.env, PORT: "3000" },
  stdio: "inherit",
  shell: true,
});

const cleanExit = () => {
  if (apiServer && !apiServer.killed) apiServer.kill();
  if (frontend && !frontend.killed) frontend.kill();
  process.exit(0);
};

process.on("SIGINT", cleanExit);
process.on("SIGTERM", cleanExit);
