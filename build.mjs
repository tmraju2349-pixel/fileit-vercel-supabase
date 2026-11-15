import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("Building workspaces...");
execSync("npm run build --workspaces --if-present", {
  stdio: "inherit",
  cwd: __dirname,
  shell: true,
});

const distDir = path.resolve(__dirname, "dist");
const distServerDir = path.resolve(distDir, "server");

fs.mkdirSync(distServerDir, { recursive: true });

const frontendDist = path.resolve(__dirname, "artifacts/fileit/dist/public");
const serverDist = path.resolve(__dirname, "artifacts/api-server/dist");

if (fs.existsSync(frontendDist)) {
  fs.cpSync(frontendDist, distDir, { recursive: true });
  console.log("✓ Copied frontend build to dist/");
}

if (fs.existsSync(serverDist)) {
  fs.cpSync(serverDist, distServerDir, { recursive: true });
  console.log("✓ Copied api-server build to dist/server/");
}

console.log("✓ Production build complete!");
