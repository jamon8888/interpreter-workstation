import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getOixStandalonePaths,
  resolveOrInstallOixRuntime,
} from "./oixRuntime";

const tempDirs: string[] = [];

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writePackage(
  packageDir: string,
  version: string,
  target = "aarch64-apple-darwin",
): string {
  const binaryPath = path.join(packageDir, "bin", "interpreter");
  mkdirSync(path.dirname(binaryPath), { recursive: true });
  mkdirSync(path.join(packageDir, "codex-path"), { recursive: true });
  mkdirSync(path.join(packageDir, "codex-resources"), { recursive: true });
  writeFileSync(binaryPath, "#!/bin/sh\necho interpreter fixture\n");
  writeFileSync(
    path.join(packageDir, "bin", "i"),
    "#!/bin/sh\necho interpreter fixture\n",
  );
  writeFileSync(
    path.join(packageDir, "bin", "codex-code-mode-host"),
    "#!/bin/sh\nexit 0\n",
  );
  writeFileSync(
    path.join(packageDir, "codex-path", "rg"),
    "#!/bin/sh\nexit 0\n",
  );
  chmodSync(binaryPath, 0o755);
  writeFileSync(
    path.join(packageDir, "codex-package.json"),
    JSON.stringify({
      layoutVersion: 1,
      version,
      target,
      variant: "open-interpreter",
      entrypoint: "bin/interpreter",
      resourcesDir: "codex-resources",
      pathDir: "codex-path",
    }),
  );
  return binaryPath;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("OIX shared runtime resolution", () => {
  test("uses the official cross-platform managed install locations", () => {
    expect(
      getOixStandalonePaths("darwin", { HOME: "/Users/alex" }, "/Users/alex"),
    ).toMatchObject({
      interpreterHome: "/Users/alex/.openinterpreter",
      managedBinary:
        "/Users/alex/.openinterpreter/packages/standalone/current/bin/interpreter",
      visibleBinary: "/Users/alex/.local/bin/interpreter",
    });
    expect(
      getOixStandalonePaths(
        "win32",
        {
          USERPROFILE: "C:\\Users\\alex",
          LOCALAPPDATA: "C:\\Users\\alex\\AppData\\Local",
        },
        "C:\\Users\\alex",
      ),
    ).toMatchObject({
      interpreterHome: "C:\\Users\\alex\\.openinterpreter",
      managedBinary:
        "C:\\Users\\alex\\.openinterpreter\\packages\\standalone\\current\\bin\\interpreter.exe",
      visibleBinary:
        "C:\\Users\\alex\\AppData\\Local\\Programs\\Open Interpreter\\bin\\interpreter.exe",
    });
  });

  test("pins the bundled app runtime without moving an existing terminal selector", async () => {
    const homeDir = await tempDir("oix-existing-home-");
    const bundleDir = await tempDir("oix-unused-bundle-");
    const interpreterHome = path.join(homeDir, ".openinterpreter");
    const releaseDir = path.join(
      interpreterHome,
      "packages",
      "standalone",
      "releases",
      "0.0.29-aarch64-apple-darwin",
    );
    const existingBinary = writePackage(releaseDir, "0.0.29");
    const currentDir = path.join(
      interpreterHome,
      "packages",
      "standalone",
      "current",
    );
    mkdirSync(path.dirname(currentDir), { recursive: true });
    symlinkSync(releaseDir, currentDir, "dir");
    writePackage(bundleDir, "0.0.34");

    const result = await resolveOrInstallOixRuntime({
      platform: "darwin",
      arch: "arm64",
      env: { HOME: homeDir, PATH: "" },
      homeDir,
      bundledPackageCandidates: [bundleDir],
      probeBinary: async () => true,
      configureTerminalPath: false,
    });

    expect(result.source).toBe("installed");
    expect(result.version).toBe("0.0.34");
    expect(realpathSync(currentDir)).toBe(realpathSync(releaseDir));
    expect(realpathSync(result.binaryPath)).not.toBe(
      realpathSync(existingBinary),
    );
    expect(
      existsSync(
        path.join(
          interpreterHome,
          "packages",
          "standalone",
          "releases",
          "0.0.34-aarch64-apple-darwin",
        ),
      ),
    ).toBe(true);
  });

  test("uses an explicit development runtime without installing the bundle", async () => {
    const homeDir = await tempDir("oix-development-home-");
    const developmentDir = await tempDir("oix-development-runtime-");
    const developmentBinary = writePackage(developmentDir, "0.0.99");
    const bundleDir = await tempDir("oix-development-bundle-");
    writePackage(bundleDir, "0.0.34");

    const result = await resolveOrInstallOixRuntime({
      platform: "darwin",
      arch: "arm64",
      env: {
        HOME: homeDir,
        PATH: "",
        INTERPRETER_OIX_PATH: developmentBinary,
      },
      homeDir,
      bundledPackageCandidates: [bundleDir],
      probeBinary: async () => true,
      configureTerminalPath: false,
    });

    expect(result.source).toBe("development");
    expect(result.version).toBe("0.0.99");
    expect(realpathSync(result.binaryPath)).toBe(
      realpathSync(developmentBinary),
    );
    expect(
      existsSync(
        path.join(homeDir, ".openinterpreter", "packages", "standalone"),
      ),
    ).toBe(false);
  });

  test("installs the bundled package into OIX managed storage when OIX is absent", async () => {
    const homeDir = await tempDir("oix-install-home-");
    const bundleDir = await tempDir("oix-install-bundle-");
    writePackage(bundleDir, "0.0.34");

    const result = await resolveOrInstallOixRuntime({
      platform: "darwin",
      arch: "arm64",
      env: { HOME: homeDir, PATH: "", SHELL: "/bin/zsh" },
      homeDir,
      bundledPackageCandidates: [bundleDir],
      probeBinary: async () => true,
      configureTerminalPath: true,
    });
    const paths = getOixStandalonePaths("darwin", { HOME: homeDir }, homeDir);

    expect(result.source).toBe("installed");
    expect(result.version).toBe("0.0.34");
    expect(result.packageDir).toBe(
      path.join(paths.releasesDir, "0.0.34-aarch64-apple-darwin"),
    );
    expect(realpathSync(paths.managedBinary)).toBe(
      realpathSync(result.binaryPath),
    );
    expect(realpathSync(paths.visibleBinary)).toBe(
      realpathSync(result.binaryPath),
    );
    expect(
      readFileSync(path.join(result.packageDir, "codex-package.json"), "utf8"),
    ).toContain("open-interpreter");
    expect(readFileSync(path.join(homeDir, ".zprofile"), "utf8")).toContain(
      `export PATH="${paths.visibleBinDir}:$PATH"`,
    );
    expect(readFileSync(paths.terminalOwnershipFile, "utf8")).toContain(
      '"version":"0.0.34"',
    );
  });

  test("advances the terminal with app updates while Workstation still owns it", async () => {
    const homeDir = await tempDir("oix-owned-update-home-");
    const firstBundle = await tempDir("oix-owned-update-first-");
    const secondBundle = await tempDir("oix-owned-update-second-");
    writePackage(firstBundle, "0.0.34");
    writePackage(secondBundle, "0.0.35");
    const options = {
      platform: "darwin" as const,
      arch: "arm64",
      env: { HOME: homeDir, PATH: "", SHELL: "/bin/zsh" },
      homeDir,
      probeBinary: async () => true,
      configureTerminalPath: false,
    };

    await resolveOrInstallOixRuntime({
      ...options,
      bundledPackageCandidates: [firstBundle],
    });
    const second = await resolveOrInstallOixRuntime({
      ...options,
      bundledPackageCandidates: [secondBundle],
    });
    const paths = getOixStandalonePaths("darwin", options.env, homeDir);

    expect(second.version).toBe("0.0.35");
    expect(realpathSync(paths.managedBinary)).toBe(
      realpathSync(second.binaryPath),
    );
    expect(readFileSync(paths.terminalOwnershipFile, "utf8")).toContain(
      '"version":"0.0.35"',
    );
  });

  test("does not move the terminal after it updates independently", async () => {
    const homeDir = await tempDir("oix-independent-update-home-");
    const firstBundle = await tempDir("oix-independent-update-first-");
    const nextAppBundle = await tempDir("oix-independent-update-app-");
    writePackage(firstBundle, "0.0.34");
    writePackage(nextAppBundle, "0.0.36");
    const options = {
      platform: "darwin" as const,
      arch: "arm64",
      env: { HOME: homeDir, PATH: "", SHELL: "/bin/zsh" },
      homeDir,
      probeBinary: async () => true,
      configureTerminalPath: false,
    };

    await resolveOrInstallOixRuntime({
      ...options,
      bundledPackageCandidates: [firstBundle],
    });
    const paths = getOixStandalonePaths("darwin", options.env, homeDir);
    const terminalRelease = path.join(
      paths.releasesDir,
      "0.0.35-aarch64-apple-darwin",
    );
    const terminalBinary = writePackage(terminalRelease, "0.0.35");
    rmSync(paths.currentDir, { recursive: true, force: true });
    symlinkSync(terminalRelease, paths.currentDir, "dir");

    const appRuntime = await resolveOrInstallOixRuntime({
      ...options,
      bundledPackageCandidates: [nextAppBundle],
    });

    expect(appRuntime.version).toBe("0.0.36");
    expect(realpathSync(appRuntime.binaryPath)).not.toBe(
      realpathSync(terminalBinary),
    );
    expect(realpathSync(paths.managedBinary)).toBe(
      realpathSync(terminalBinary),
    );
    expect(existsSync(paths.terminalOwnershipFile)).toBe(false);
  });

  test("does not use a non-OIX interpreter on PATH as the app runtime", async () => {
    const homeDir = await tempDir("oix-path-home-");
    const unrelatedBinDir = await tempDir("oix-unrelated-bin-");
    const unrelatedBinary = path.join(unrelatedBinDir, "interpreter");
    writeFileSync(unrelatedBinary, "#!/bin/sh\necho unrelated\n");
    chmodSync(unrelatedBinary, 0o755);
    const bundleDir = await tempDir("oix-path-bundle-");
    writePackage(bundleDir, "0.0.34");

    const result = await resolveOrInstallOixRuntime({
      platform: "darwin",
      arch: "arm64",
      env: { HOME: homeDir, PATH: unrelatedBinDir },
      homeDir,
      bundledPackageCandidates: [bundleDir],
      probeBinary: async (candidate) => candidate !== unrelatedBinary,
      configureTerminalPath: false,
    });

    expect(result.source).toBe("installed");
    expect(result.binaryPath).not.toBe(unrelatedBinary);
  });

  test("fails clearly when neither an existing nor bundled OIX is valid", async () => {
    const homeDir = await tempDir("oix-missing-home-");
    await expect(
      resolveOrInstallOixRuntime({
        platform: "darwin",
        arch: "arm64",
        env: { HOME: homeDir, PATH: "" },
        homeDir,
        bundledPackageCandidates: [],
        probeBinary: async () => false,
        configureTerminalPath: false,
      }),
    ).rejects.toThrow("No valid bundled Open Interpreter runtime was found");
  });

  test("rejects package metadata that could escape the managed releases directory", async () => {
    const homeDir = await tempDir("oix-unsafe-home-");
    const bundleDir = await tempDir("oix-unsafe-bundle-");
    writePackage(bundleDir, "0.0.34", "../../outside");

    await expect(
      resolveOrInstallOixRuntime({
        platform: "darwin",
        arch: "arm64",
        env: { HOME: homeDir, PATH: "" },
        homeDir,
        bundledPackageCandidates: [bundleDir],
        probeBinary: async () => false,
        configureTerminalPath: false,
      }),
    ).rejects.toThrow("No valid bundled Open Interpreter runtime was found");
    expect(existsSync(path.join(homeDir, "outside"))).toBe(false);
  });
});
