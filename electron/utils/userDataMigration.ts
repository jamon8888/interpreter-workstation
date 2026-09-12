import fs from 'node:fs';
import path from 'node:path';

/**
 * Carry an existing installation's data across the product rename.
 *
 * `app.getPath('userData')` is derived from `app.setName()`, so renaming the
 * product moves the directory out from under every existing install. Nothing
 * else migrates it: on first launch after the update the app finds an empty
 * directory and behaves as a fresh install.
 *
 * The vault is why this is not merely cosmetic. `server/services/vaultKey.ts`
 * keeps the data-protection key at `{userData}/vaults/.vault-key.enc`. A new
 * directory means no key is found, a replacement is minted, and every blob
 * encrypted under the old one becomes undecryptable.
 */

export type SkipReason =
  | 'not-named-after-product'
  | 'name-unchanged'
  | 'no-previous-data'
  | 'current-holds-data';

export type UserDataMigrationPlan =
  | { action: 'none'; code: SkipReason; reason: string }
  | { action: 'move'; from: string; to: string };

export type MigrationProbe = {
  exists(dirPath: string): boolean;
  hasEntries(dirPath: string): boolean;
};

/**
 * Decide what to do, without touching the filesystem, so the rules are
 * testable on their own.
 *
 * The legacy directory is the current one with the brand segment of its name
 * swapped, which keeps suffixed variants (`… Internal`) paired with their own
 * predecessor rather than with the plain one.
 */
export function planUserDataMigration(options: {
  currentDir: string;
  currentName: string;
  legacyName: string;
  probe: MigrationProbe;
}): UserDataMigrationPlan {
  const { currentDir, currentName, legacyName, probe } = options;

  const basename = path.basename(currentDir);
  if (!basename.includes(currentName)) {
    return {
      action: 'none',
      code: 'not-named-after-product',
      reason: 'the data directory is not named after the product',
    };
  }

  // `String.prototype.replace` with a string pattern rewrites only the first
  // occurrence, which is what pairs `Hacienda Internal` with
  // `Interpreter Internal`. It assumes the two names do not nest inside one
  // another; a future rename that breaks that assumption needs a real parse,
  // not a wider replace.
  const legacyDir = path.join(path.dirname(currentDir), basename.replace(currentName, legacyName));
  if (legacyDir === currentDir) {
    return { action: 'none', code: 'name-unchanged', reason: 'the product name did not change' };
  }

  if (!probe.exists(legacyDir) || !probe.hasEntries(legacyDir)) {
    return { action: 'none', code: 'no-previous-data', reason: 'no previous data directory to carry over' };
  }

  // An existing current directory with content belongs to a launch that already
  // happened. Overwriting it would destroy newer data to recover older data.
  // `exists` and `hasEntries` both follow symlinks, so a link pointing at a
  // populated directory reads as data here and declines the move rather than
  // reaching the removal below.
  if (probe.exists(currentDir) && probe.hasEntries(currentDir)) {
    return {
      action: 'none',
      code: 'current-holds-data',
      reason: 'the current data directory already holds data',
    };
  }

  return { action: 'move', from: legacyDir, to: currentDir };
}

const probe: MigrationProbe = {
  exists: (dirPath) => {
    try {
      return fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  },
  hasEntries: (dirPath) => {
    try {
      return fs.readdirSync(dirPath).length > 0;
    } catch {
      return false;
    }
  },
};

/**
 * Apply the plan. Returns what was done so the caller can log it.
 *
 * Failures are reported, never thrown: a migration that cannot run must not
 * stop the app from starting. The user then sees a fresh install, which is the
 * situation this function exists to avoid but is still better than no launch.
 */
export function migrateUserDataDirectory(options: {
  currentDir: string;
  currentName: string;
  legacyName: string;
}): UserDataMigrationPlan | { action: 'failed'; from: string; to: string; error: string } {
  const plan = planUserDataMigration({ ...options, probe });
  if (plan.action !== 'move') {
    return plan;
  }

  try {
    fs.mkdirSync(path.dirname(plan.to), { recursive: true });
    // The plan only reaches here when the target is absent or empty, and
    // renaming onto an existing directory fails on Windows. Clearing it first
    // costs nothing, since the plan already established it holds no data. A
    // symlink has to be unlinked rather than removed as a directory, or the
    // rename fails against a link the plan already found empty.
    try {
      const target = fs.lstatSync(plan.to);
      if (target.isSymbolicLink()) {
        fs.unlinkSync(plan.to);
      } else if (target.isDirectory()) {
        fs.rmdirSync(plan.to);
      }
    } catch {}
    // `rename` is atomic within a filesystem, which is the normal case since
    // both directories are siblings. `cpSync` covers the rest, and leaves the
    // source in place: a copy that half-succeeded must not also be a deletion.
    try {
      fs.renameSync(plan.from, plan.to);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
      fs.cpSync(plan.from, plan.to, { recursive: true });
    }
    return plan;
  } catch (error) {
    return {
      action: 'failed',
      from: plan.from,
      to: plan.to,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
