import { spawn } from "node:child_process";

const port = process.env.PORT || "4173";
const args = ["vite", "preview", "--host", "0.0.0.0", "--port", port];

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

