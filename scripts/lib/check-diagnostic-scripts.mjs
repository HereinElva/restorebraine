/**
 * Warn when Mac repo has outdated diagnostic scripts (false negatives on live OAuth).
 */
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BRANCH = 'cursor/apple-privacy-plist-bacf';
const REQUIRED = 'scripts/lib/oauth-bundle-detect.mjs';

export function checkDiagnosticScriptsFreshness({ exitOnStale = false } = {}) {
  const warnings = [];

  if (!existsSync(REQUIRED)) {
    warnings.push(
      `Missing ${REQUIRED} — live OAuth detection is outdated (only matches fe=, not de=).`,
      `Run: git pull origin ${BRANCH}`,
    );
  }

  let head = '?';
  let origin = null;
  try {
    head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    execSync(`git fetch origin ${BRANCH} 2>/dev/null`, { stdio: 'ignore' });
    origin = execSync(`git rev-parse --short origin/${BRANCH}`, { encoding: 'utf8' }).trim();
    if (head !== origin) {
      try {
        execSync(`git merge-base --is-ancestor HEAD origin/${BRANCH}`, { stdio: 'ignore' });
        warnings.push(
          `Diagnostic scripts behind origin (${head} vs ${origin}).`,
          `Run: cd $(git rev-parse --show-toplevel) && git pull origin ${BRANCH}`,
          `Then: npm run diagnose:all  (expect 6/6 when live Base44 OAuth is fixed)`,
        );
      } catch {
        /* HEAD ahead or diverged — not a pull-behind case */
      }
    }
  } catch {
    /* offline — skip fetch comparison */
  }

  if (warnings.length) {
    console.log('⚠ OUTDATED DIAGNOSTIC SCRIPTS — results may be false negatives');
    console.log(`  HEAD: ${head}${origin ? `   origin/${BRANCH}: ${origin}` : ''}`);
    for (const w of warnings) console.log(`  ${w}`);
    console.log('');
    if (exitOnStale) process.exit(2);
    return { stale: true, head, origin, warnings };
  }

  return { stale: false, head, origin, warnings: [] };
}
