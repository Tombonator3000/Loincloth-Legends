// Vite-utvidelse for brettverkstedet (STAGE FORGE). Bare under `npm run dev`, og bare fra maskinen selv:
//   GET  /__forge/ping    svarer «stage-forge»
//   POST /__forge/layout  { level, json }        skriver src/data/layouts/<level>.json
//   POST /__forge/prop    { id, meta, data? }    skriver public/assets/prop_<id>.webp (data er base64) og manifestet
// Filene editoren nettopp har skrevet, gir ingen ny innlasting av siden (editoren har dem allerede).
import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage } from 'node:http';

const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const MAX_BODY = 40 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res, rej) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        rej(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rej);
  });
}

/** Bare feltene manifestet kjenner, med riktige typer. */
function cleanMeta(id: string, m: Record<string, unknown>) {
  const out: Record<string, unknown> = { file: typeof m.file === 'string' && /^prop_[a-z0-9_]+\.webp$/.test(m.file) ? m.file : `prop_${id}.webp` };
  if (typeof m.w === 'number' && m.w > 0 && m.w < 200) out.w = Math.round(m.w * 1000) / 1000;
  if (Array.isArray(m.anchor) && m.anchor.length === 2 && m.anchor.every((v) => typeof v === 'number')) out.anchor = (m.anchor as number[]).map((v) => Math.round(v * 1000) / 1000);
  if (typeof m.layer === 'string' && ['far', 'back', 'mid', 'front'].includes(m.layer)) out.layer = m.layer;
  if (Array.isArray(m.grid) && m.grid.length === 2 && m.grid.every((v) => Number.isInteger(v) && v >= 1 && v <= 32)) {
    out.grid = m.grid;
    if (Number.isInteger(m.n) && (m.n as number) >= 1) out.n = Math.min(m.n as number, (m.grid[0] as number) * (m.grid[1] as number));
  }
  if (m.anim !== undefined) out.anim = m.anim;
  if (Array.isArray(m.preset)) {
    const parts = (m.preset as Record<string, unknown>[]).filter((q) => q && typeof q.prop === 'string' && /^[a-z0-9_]{1,40}$/.test(q.prop) && typeof q.dx === 'number' && typeof q.dy === 'number');
    if (parts.length) out.preset = parts.slice(0, 32).map((q) => {
      const o: Record<string, unknown> = { prop: q.prop, dx: Math.round((q.dx as number) * 1000) / 1000, dy: Math.round((q.dy as number) * 1000) / 1000 };
      for (const k of ['dz', 'scale', 'rot']) if (typeof q[k] === 'number') o[k] = Math.round((q[k] as number) * 1000) / 1000;
      if (q.flip === true) o.flip = true;
      if (Array.isArray(q.anim)) o.anim = q.anim;
      return o;
    });
  }
  for (const k of ['shadow', 'fade']) if (typeof m[k] === 'boolean') out[k] = m[k];
  if (typeof m.dark === 'number') out.dark = m.dark;
  if (typeof m.label === 'string') out.label = m.label.slice(0, 60);
  return out;
}

export function stageForge(): Plugin {
  const root = process.cwd();
  const layouts = path.join(root, 'src', 'data', 'layouts');
  const assets = path.join(root, 'public', 'assets');
  const manifest = path.join(assets, 'manifest.json');
  const recent = new Map<string, number>();
  const justSaved = (file: string) => {
    const t = recent.get(path.normalize(file));
    return t !== undefined && Date.now() - t < 4000;
  };
  return {
    name: 'stage-forge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__forge', (req, res) => {
        void (async () => {
          try {
            if (!LOCAL.has(req.socket.remoteAddress ?? '')) {
              res.statusCode = 403;
              res.end('STAGE FORGE saves only from this machine');
              return;
            }
            const url = req.url ?? '/';
            if (req.method === 'GET' && url.startsWith('/ping')) {
              res.end('stage-forge');
              return;
            }
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end();
              return;
            }
            const data = JSON.parse(await readBody(req)) as Record<string, unknown>;
            if (url.startsWith('/layout')) {
              const level = String(data.level ?? '');
              if (!/^[a-z0-9_-]{1,40}$/.test(level)) throw new Error('bad level id');
              const json = String(data.json ?? '');
              JSON.parse(json);
              fs.mkdirSync(layouts, { recursive: true });
              const file = path.join(layouts, level + '.json');
              recent.set(path.normalize(file), Date.now());
              fs.writeFileSync(file, json);
              res.end('ok');
              return;
            }
            if (url.startsWith('/prop')) {
              const id = String(data.id ?? '');
              if (!/^[a-z0-9_]{1,40}$/.test(id)) throw new Error('bad prop id');
              const meta = cleanMeta(id, (data.meta ?? {}) as Record<string, unknown>);
              if (typeof data.data === 'string') {
                const bytes = Buffer.from(data.data, 'base64');
                // Safari lager PNG når den blir bedt om WebP. Resten av repoet (manifestet og check_art_pack.py) vil ha WebP.
                if (bytes.toString('latin1', 0, 4) !== 'RIFF' || bytes.toString('latin1', 8, 12) !== 'WEBP') {
                  throw new Error('this browser did not make a WebP image (Safari?). Use Chrome, Edge or Firefox, or put the PNG in art/inbox and run tools/process_art.py');
                }
                const file = path.join(assets, String(meta.file));
                recent.set(path.normalize(file), Date.now());
                fs.writeFileSync(file, bytes);
              }
              const man = JSON.parse(fs.readFileSync(manifest, 'utf8')) as Record<string, unknown>;
              const props = (man.props ??= {}) as Record<string, unknown>;
              props[id] = meta;
              recent.set(path.normalize(manifest), Date.now());
              fs.writeFileSync(manifest, JSON.stringify(man, null, 2) + '\n');
              res.end('ok');
              return;
            }
            res.statusCode = 404;
            res.end('unknown');
          } catch (e) {
            res.statusCode = 400;
            res.end(String((e as Error).message ?? e));
          }
        })();
      });
    },
    // Ingen ny innlasting for filer editoren nettopp skrev (Vite 6 og nyere, også nye filer)
    hotUpdate(ctx) {
      if (justSaved(ctx.file)) return [];
    },
    handleHotUpdate(ctx) {
      if (justSaved(ctx.file)) return [];
    },
  };
}
