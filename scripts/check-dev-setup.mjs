import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const frontendEnvPath = path.join(rootDir, "artifacts", "huddle", ".env.local");
const frontendExamplePath = path.join(rootDir, "artifacts", "huddle", ".env.example");

const REQUIRED_FRONTEND_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const result = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
    result[key] = value;
  }

  return result;
}

function isMissingValue(value) {
  if (!value) return true;
  const normalized = value.trim();
  return normalized === "" || normalized === "..." || normalized.toLowerCase() === "changeme";
}

const frontendEnv = parseEnvFile(frontendEnvPath);
const missingFrontendKeys = REQUIRED_FRONTEND_KEYS.filter((key) =>
  isMissingValue(process.env[key] ?? frontendEnv[key]),
);

if (missingFrontendKeys.length > 0) {
  console.error("");
  console.error("Dev setup check failed.");
  console.error("Missing Firebase variables for the web app:");
  for (const key of missingFrontendKeys) console.error(`- ${key}`);
  console.error("");
  console.error(`Create ${path.relative(rootDir, frontendEnvPath)} using this template:`);
  console.error(`  ${path.relative(rootDir, frontendExamplePath)}`);
  console.error("");
  process.exit(1);
}

console.log("Dev setup check passed.");
