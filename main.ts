// VENTARA BAY — the entry program (Node 22, standard library only).
// It hands the game in: copies this repository's game/ and screenshots/
// beside it into /output, then writes /output/dossier.json with the
// vendored make.fun library, so the judge reads the same bytes the
// scorer checks. Deterministic: no timestamps, no random input, so two
// runs write byte-identical output.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, from the kit's reference/gate.json: the dossier
// text is capped at 160 KiB, at most 4 screenshots of 256 KiB each, and
// game/ holds at most 993 files and 48 MiB in all. The program refuses
// before writing anything the scorer would refuse.
const DOSSIER_TEXT_MAX_BYTES = 163840;
const SCREENSHOTS_MAX = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;
const GAME_PATH_MAX_BYTES = 1000;

function countGameFiles(dir, base) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = base ? base + '/' + name : name;
    const st = statSync(path);
    if (st.isDirectory()) {
      const sub = countGameFiles(path, rel);
      files += sub.files; bytes += sub.bytes;
    } else {
      files += 1;
      bytes += st.size;
      if (Buffer.byteLength(rel, 'utf8') > GAME_PATH_MAX_BYTES) {
        throw new Error('game path over the cap: ' + rel);
      }
    }
  }
  return { files, bytes };
}

function checkScreenshots(dir) {
  if (!existsSync(dir)) throw new Error('screenshots/ is missing');
  const names = readdirSync(dir).filter((n) => !n.startsWith('.')).sort();
  if (names.length < 3 || names.length > SCREENSHOTS_MAX) {
    throw new Error('need 3 or 4 screenshots, found ' + names.length);
  }
  for (const name of names) {
    const size = statSync(join(dir, name)).size;
    if (size > SCREENSHOT_MAX_BYTES) throw new Error('screenshot over 256 KiB: ' + name);
  }
  return names;
}

function handIn() {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  const counted = countGameFiles(gameDir, '');
  if (counted.files > GAME_MAX_FILES) throw new Error('game/ holds too many files: ' + counted.files);
  if (counted.bytes > GAME_MAX_BYTES) throw new Error('game/ is too large: ' + counted.bytes + ' bytes');
  const shotNames = checkScreenshots(shotsDir);

  mkdirSync(outputDir, { recursive: true });
  cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

  writeFileSync(
    join(outputDir, 'dossier.json'),
    buildDossier(outputDir, {
      text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
      screenshots: { max: SCREENSHOTS_MAX, max_bytes: SCREENSHOT_MAX_BYTES },
      game_max_files: GAME_MAX_FILES,
      game_max_bytes: GAME_MAX_BYTES,
      game_path_max_bytes: GAME_PATH_MAX_BYTES,
    }),
  );
  return { gameFiles: counted.files, gameBytes: counted.bytes, screenshots: shotNames };
}

const result = handIn();
console.log(
  'VENTARA BAY handed in: ' + result.gameFiles + ' game files (' + result.gameBytes +
  ' bytes), screenshots: ' + result.screenshots.join(', '),
);
