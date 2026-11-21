// Solmar Heat — the hand-in program for make.fun's gta6-01 bounty (Node 22, standard
// library only). The game itself is the game/ folder beside this file: plain static
// files (game/index.html and its ES modules) that a desktop browser loads offline —
// no build step, no library, no network request. This program copies game/ and
// screenshots/ to the output directory and writes dossier.json there, the summary
// the judge reads, built with the vendored make.fun library in vendor/ (untouched).
//
// Play it locally first: `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game, whole: every source file under game/, exactly as the browser gets it.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

// The screenshots the judge sees first: four real frames of the game running.
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The dossier, under the scorer's own caps (reference/gate.json): at most 4
// screenshots of at most 256 KiB each; at most 993 files and 48 MiB under game/;
// no game path over 1000 bytes; the source text the judge reads capped at 163,840
// bytes. An entry the scorer would refuse is refused here instead, by the same gate.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
