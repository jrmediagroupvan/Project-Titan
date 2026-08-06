import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { timingSafeEqual } from "node:crypto";

const token = process.env.TITAN_UPDATE_TOKEN || "";
const projectDir = process.env.TITAN_PROJECT_DIR || "";
const repository = process.env.TITAN_GIT_REPOSITORY || "";

let status = {
  state: "idle",
  log: [],
};

function authorized(request) {
  const supplied = (request.headers.authorization || "").replace(
    /^Bearer\s+/i,
    "",
  );

  const left = Buffer.from(supplied);
  const right = Buffer.from(token);

  return (
    token.length >= 32 &&
    left.length === right.length &&
    timingSafeEqual(left, right)
  );
}

function send(response, code, payload) {
  response.writeHead(code, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function append(chunk) {
  status.log = [
    ...(status.log || []),
    ...String(chunk)
      .split(/\r?\n/)
      .filter(Boolean),
  ].slice(-250);
}

function start() {
  if (status.state === "running") {
    return false;
  }

  status = {
    state: "running",
    startedAt: new Date().toISOString(),
    log: [],
  };

  append("Starting Project TITAN one-click update...");

  const child = spawn("bash", ["scripts/update-staged.sh"], {
    cwd: projectDir,
    env: {
      ...process.env,
      TITAN_WEB_UPDATE: "1",
      TITAN_GIT_REPOSITORY: repository,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", append);
  child.stderr.on("data", append);

  child.on("error", (error) => {
    append(error.message);
    status = {
      ...status,
      state: "failed",
      finishedAt: new Date().toISOString(),
      exitCode: 1,
    };
  });

  child.on("close", (code) => {
    status = {
      ...status,
      state: code === 0 ? "succeeded" : "failed",
      finishedAt: new Date().toISOString(),
      exitCode: code ?? 1,
    };
  });

  return true;
}

if (!projectDir || !repository || token.length < 32) {
  console.error(
    "TITAN_PROJECT_DIR, TITAN_GIT_REPOSITORY and a 32+ character TITAN_UPDATE_TOKEN are required.",
  );
  process.exit(1);
}

spawnSync(
  "git",
  ["config", "--global", "--add", "safe.directory", projectDir],
  { env: { ...process.env, HOME: "/tmp" } },
);

createServer((request, response) => {
  if (!authorized(request)) {
    return send(response, 401, { error: "Unauthorized" });
  }

  if (request.method === "GET" && request.url === "/status") {
    return send(response, 200, status);
  }

  if (request.method === "POST" && request.url === "/update") {
    if (!start()) {
      return send(response, 409, {
        error: "An update is already running",
        ...status,
      });
    }

    return send(response, 202, status);
  }

  return send(response, 404, { error: "Not found" });
}).listen(8787, "0.0.0.0", () => {
  console.log("Project TITAN one-click updater ready on port 8787.");
});
