import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lockfile = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));

const runtimeDependencyFields = [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "bundleDependencies",
  "bundledDependencies"
];

const nonEmptyFields = runtimeDependencyFields.filter((field) => {
  const value = packageJson[field];

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== undefined && Object.keys(value).length > 0;
});

const rootLockPackage = lockfile.packages?.[""] ?? {};
const nonEmptyLockFields = runtimeDependencyFields.filter((field) => {
  const value = rootLockPackage[field];

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== undefined && Object.keys(value).length > 0;
});

const failures = [
  ...nonEmptyFields.map((field) => `package.json contains runtime dependency field: ${field}`),
  ...nonEmptyLockFields.map((field) => `package-lock.json root package contains runtime dependency field: ${field}`)
];

const sourceFiles = (directory) => {
  const directoryPath = directory instanceof URL ? fileURLToPath(directory) : directory;

  return readdirSync(directoryPath).flatMap((entry) => {
    const path = join(directoryPath, entry);

    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }

    return path.endsWith(".ts") ? [path] : [];
  });
};

const bareImportPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^."'/][^"']*)["']/g;

for (const file of sourceFiles(sourceRoot)) {
  const source = readFileSync(file, "utf8");

  for (const match of source.matchAll(bareImportPattern)) {
    const specifier = match[1];

    if (specifier !== undefined && !specifier.startsWith("node:")) {
      failures.push(`${relative(projectRoot, file)} imports external runtime module: ${specifier}`);
    }
  }
}

if (failures.length > 0) {
  console.error(["Runtime dependency check failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"));
  process.exitCode = 1;
}
