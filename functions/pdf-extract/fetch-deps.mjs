/* Temporary one-off script: vendor pdf-parse from unpkg into node_modules (registry tarball is unreachable in this environment). */
import fs from 'node:fs/promises';

const BASE = 'https://unpkg.com/pdf-parse@2.4.5';
const ROOT = 'C:\\src\\autofix_ai\\functions\\pdf-extract\\node_modules\\pdf-parse';

async function get(p) {
  const res = await fetch(`${BASE}/${p}`);
  if (!res.ok) throw new Error(`${p}: ${res.status}`);
  return res.arrayBuffer();
}

async function put(p, buf) {
  const dir = p.split('/').slice(0, -1).join('/');
  if (dir) await fs.mkdir(`${ROOT}/${dir}`, { recursive: true });
  await fs.writeFile(`${ROOT}/${p}`, Buffer.from(buf));
}

async function listDir(dir) {
  const html = await (await fetch(`${BASE}/${dir}`)).text();
  const links = [];
  const re = /href="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) links.push(m[1]);
  return links;
}

async function main() {
  await fs.mkdir(ROOT, { recursive: true });
  const indexFiles = await listDir('dist/pdf-parse/esm/');
  const files = indexFiles.filter(f => f.endsWith('.js') || f.endsWith('.d.ts'));
  for (const f of files) {
    const p = 'dist/pdf-parse/esm/' + f;
    try {
      const buf = await get(p);
      await put(p, buf);
      console.log('ok', p, buf.byteLength);
    } catch (e) {
      console.warn('skip', p, e.message);
    }
  }
  console.log('done');
}

main();

