import { spawn } from "node:child_process";

function run(command, args, opts = {}) {
  return spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
}

const check = run("pnpm", ["run", "dev:check"]);

check.on("exit", (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
    return;
  }

  const api = run("pnpm", ["run", "dev:api"]);
  const web = run("pnpm", ["run", "dev:web"]);

  const stopAll = () => {
    api.kill();
    web.kill();
  };

  process.on("SIGINT", () => {
    stopAll();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    stopAll();
    process.exit(0);
  });

  api.on("exit", (apiCode) => {
    if (apiCode && apiCode !== 0) {
      web.kill();
      process.exit(apiCode);
    }
  });

  web.on("exit", (webCode) => {
    if (webCode && webCode !== 0) {
      api.kill();
      process.exit(webCode);
    }
  });
});
