#!/usr/bin/env node
/**
 * Downloads the basemind binary for the current platform into
 * resources/basemind/<platform-arch>/, the way download-oix.mjs stages the OIX
 * runtime. Packaging picks it up from there through `extraResources`.
 *
 * Usage:
 *   node scripts/download-basemind.mjs [--current-platform] [--platform <key>] [version]
 *
 * PINNED VERSION CAVEAT (#186): v0.29.0 is the only published release, and it
 * predates the `redact_text` MCP tool by 34 commits — the tool Workstation's
 * PII detection calls. Downloading this version therefore gives a working
 * basemind that cannot redact. Move the pin to the first release built from
 * basemind `09d7afb4` or later, and this script needs no other change.
 *
 * The archives are flat: the executable sits beside ~94 shared libraries it
 * loads at runtime, so the whole archive is staged together and the binary is
 * used in place rather than copied out.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASEMIND_DIR = path.join(ROOT, 'resources', 'basemind');
const BASEMIND_REPO = 'jamon8888/basemind';

export const PINNED_VERSION = 'v0.29.0';

const PLATFORMS = {
  'darwin-arm64': { target: 'aarch64-apple-darwin', archive: 'tar.gz' },
  'darwin-x64': { target: 'x86_64-apple-darwin', archive: 'tar.gz' },
  'linux-arm64': { target: 'aarch64-unknown-linux-gnu', archive: 'tar.gz' },
  'linux-x64': { target: 'x86_64-unknown-linux-gnu', archive: 'tar.gz' },
  'win32-x64': { target: 'x86_64-pc-windows-msvc', archive: 'zip' },
};

export const BASEMIND_PLATFORMS = PLATFORMS;
export const PLATFORM_KEYS = Object.keys(PLATFORMS);

export function getBinaryName(platform) {
  return platform.startsWith('win32') ? 'basemind.exe' : 'basemind';
}

export function getArchiveConfig(platform, version = PINNED_VERSION) {
  const config = PLATFORMS[platform];
  if (!config) return undefined;
  return {
    ...config,
    asset: `basemind-${config.target}.${config.archive}`,
    // The checksum file carries the bare version, not the tag: v0.29.0 ships
    // basemind_0.29.0_checksums.txt.
    checksumAsset: `basemind_${version.replace(/^v/, '')}_checksums.txt`,
  };
}

export function getPlatformKey(platform = process.platform, arch = process.arch) {
  return `${platform === 'win32' ? 'win32' : platform}-${arch}`;
}

export function getDownloadUrl(version, asset) {
  return `https://github.com/${BASEMIND_REPO}/releases/download/${version}/${asset}`;
}

export function parseArgs(args) {
  const currentPlatformOnly = args.includes('--current-platform');
  const platformIndex = args.indexOf('--platform');
  const requestedPlatform = platformIndex !== -1 ? args[platformIndex + 1] : undefined;
  const version = args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--platform')
    || PINNED_VERSION;
  return { currentPlatformOnly, requestedPlatform, version };
}

function hasGhWithAuth() {
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function downloadWithCurl(version, asset, destinationDir) {
  execFileSync(
    'curl',
    [
      '-sSL', '--fail',
      // Without these a stalled connection hangs indefinitely and the retries
      // never fire: observed hanging for 13 minutes on a few-hundred-byte
      // checksum file. Fail fast, then retry.
      '--connect-timeout', '20',
      '--max-time', '600',
      '--retry', '3', '--retry-all-errors', '--retry-delay', '3',
      '-o', path.join(destinationDir, asset), getDownloadUrl(version, asset),
    ],
    { stdio: 'pipe' },
  );
}

function downloadAsset(version, asset, destinationDir) {
  // `gh` is preferred because it carries the user's auth for a private or
  // rate-limited repo, but its asset redirect has been seen to time out where
  // a plain curl of the same URL succeeds — so a failure there falls through
  // rather than aborting the whole download.
  if (hasGhWithAuth()) {
    try {
      execFileSync(
        'gh',
        ['release', 'download', version, '--repo', BASEMIND_REPO, '--pattern', asset, '--dir', destinationDir],
        { stdio: 'pipe' },
      );
      return;
    } catch {
      console.log(`  gh failed for ${asset}, falling back to curl`);
    }
  }
  downloadWithCurl(version, asset, destinationDir);
}

function verifyArchiveDigest(assetPath, checksumPath) {
  const assetName = path.basename(assetPath);
  const line = fs.readFileSync(checksumPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().endsWith(` ${assetName}`) || entry.trim().endsWith(`*${assetName}`));
  if (!line) {
    throw new Error(`No checksum found for ${assetName} in ${path.basename(checksumPath)}`);
  }
  const expected = line.trim().split(/\s+/)[0];
  const actual = createHash('sha256').update(fs.readFileSync(assetPath)).digest('hex');
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${assetName}: expected ${expected}, got ${actual}`);
  }
}

function extractArchive(assetPath, destinationDir, archive) {
  if (archive === 'zip') {
    // bsdtar reads zip on Windows and macOS; unzip is the more common POSIX
    // tool. Try unzip first and fall back rather than assuming either.
    try {
      execFileSync('unzip', ['-q', '-o', assetPath, '-d', destinationDir], { stdio: 'pipe' });
      return;
    } catch {
      execFileSync('tar', ['-xf', assetPath, '-C', destinationDir], { stdio: 'pipe' });
      return;
    }
  }
  execFileSync('tar', ['-xzf', assetPath, '-C', destinationDir], { stdio: 'pipe' });
}

async function downloadAndStage(version, platform) {
  const config = getArchiveConfig(platform, version);
  if (!config) {
    throw new Error(`No basemind binary published for platform: ${platform}`);
  }

  const platformDir = path.join(BASEMIND_DIR, platform);
  const binaryPath = path.join(platformDir, getBinaryName(platform));

  if (fs.existsSync(binaryPath)) {
    console.log(`ok ${platform}: already exists`);
    return;
  }

  console.log(`download ${platform}: ${config.asset}...`);
  fs.mkdirSync(platformDir, { recursive: true });
  const tmpDir = path.join(BASEMIND_DIR, '.tmp', platform);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    downloadAsset(version, config.asset, tmpDir);
    downloadAsset(version, config.checksumAsset, tmpDir);

    const assetPath = path.join(tmpDir, config.asset);
    verifyArchiveDigest(assetPath, path.join(tmpDir, config.checksumAsset));
    extractArchive(assetPath, tmpDir, config.archive);

    // Flat archive: everything beside the binary is a runtime dependency, so
    // the whole extraction is staged, minus the archive and checksum files.
    for (const entry of fs.readdirSync(tmpDir)) {
      if (entry === config.asset || entry === config.checksumAsset) continue;
      fs.cpSync(path.join(tmpDir, entry), path.join(platformDir, entry), { recursive: true, force: true });
    }

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`basemind binary not found after extraction: ${binaryPath}`);
    }
    if (!platform.startsWith('win32')) {
      fs.chmodSync(binaryPath, 0o755);
    }
    console.log(`ok ${platform}: staged in ${path.relative(ROOT, platformDir)}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function main() {
  const { currentPlatformOnly, requestedPlatform, version } = parseArgs(process.argv.slice(2));
  const platforms = requestedPlatform
    ? [requestedPlatform]
    : currentPlatformOnly
      ? [getPlatformKey()]
      : PLATFORM_KEYS;

  for (const platform of platforms) {
    await downloadAndStage(version, platform);
  }
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '')) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
