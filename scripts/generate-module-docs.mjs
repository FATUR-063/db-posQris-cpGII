#!/usr/bin/env node
/**
 * Generate docs/modules/*.md — satu file per modul NestJS di src/.
 * Setiap file berisi salinan lengkap seluruh baris kode .ts modul tersebut.
 *
 * Usage: node scripts/generate-module-docs.mjs
 *        npm run docs:modules
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'docs', 'modules');
const SRC_DIR = join(ROOT, 'src');

/** @type {Record<string, { dir: string, recursive: boolean, label: string }>} */
const MODULES = {
  auth: { dir: join(SRC_DIR, 'auth'), recursive: true, label: 'Auth' },
  billing: { dir: join(SRC_DIR, 'billing'), recursive: true, label: 'Billing' },
  items: { dir: join(SRC_DIR, 'items'), recursive: true, label: 'Items' },
  payment: { dir: join(SRC_DIR, 'payment'), recursive: true, label: 'Payment' },
  accounting: {
    dir: join(SRC_DIR, 'accounting'),
    recursive: true,
    label: 'Accounting',
  },
  prisma: { dir: join(SRC_DIR, 'prisma'), recursive: true, label: 'Prisma' },
  app: { dir: SRC_DIR, recursive: false, label: 'App (root)' },
};

/**
 * @param {string} dir
 * @param {boolean} recursive
 * @returns {Promise<string[]>}
 */
async function collectTsFiles(dir, recursive) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        files.push(...(await collectTsFiles(fullPath, true)));
      }
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

/**
 * @param {string} text
 */
function slugify(text) {
  return text
    .replace(/[/.]/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

/**
 * @param {string} relPath
 * @param {string} content
 */
function countLines(content) {
  return content.split('\n').length;
}

/**
 * @param {string} moduleKey
 * @param {{ dir: string, recursive: boolean, label: string }} config
 */
async function generateModuleDoc(moduleKey, config) {
  const files = await collectTsFiles(config.dir, config.recursive);
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 19);

  let totalLines = 0;
  const sections = [];

  for (const absPath of files) {
    const content = await readFile(absPath, 'utf8');
    const relPath = relative(ROOT, absPath).split(sep).join('/');
    const lines = countLines(content);
    totalLines += lines;

    sections.push({
      relPath,
      content,
      lines,
      anchor: slugify(relPath),
    });
  }

  const tree = files
    .map((f) => relative(config.dir, f).split(sep).join('/'))
    .map((f) => `├── ${f}`)
    .join('\n');

  const toc = sections
    .map((s) => `- [${s.relPath}](#${s.anchor}) (${s.lines} baris)`)
    .join('\n');

  const body = sections
    .map(
      (s) => `## ${s.relPath}

\`\`\`typescript
${s.content.replace(/\r\n/g, '\n')}
\`\`\`
`,
    )
    .join('\n---\n\n');

  const markdown = `# Dokumentasi Modul — ${config.label}

> **Di-generate otomatis.** Jangan edit manual — perbarui dengan:
>
> \`\`\`bash
> npm run docs:modules
> \`\`\`

| | |
|---|---|
| **Modul** | \`${moduleKey}\` |
| **Folder sumber** | \`${relative(ROOT, config.dir).split(sep).join('/')}\` |
| **Diperbarui** | ${timestamp} |
| **Total file** | ${files.length} |
| **Total baris kode** | ${totalLines} |

---

## Struktur file

\`\`\`
${relative(ROOT, config.dir).split(sep).join('/')}/
${tree}
\`\`\`

---

## Daftar isi

${toc}

---

${body}`;

  const outPath = join(OUT_DIR, `${moduleKey}.md`);
  await writeFile(outPath, markdown, 'utf8');

  return { moduleKey, outPath, fileCount: files.length, totalLines };
}

async function generateIndex(results) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const rows = results
    .map(
      (r) =>
        `| [${MODULES[r.moduleKey].label}](./${r.moduleKey}.md) | \`${r.moduleKey}\` | ${r.fileCount} | ${r.totalLines} |`,
    )
    .join('\n');

  const index = `# Dokumentasi Modul \`src/\`

> Index di-generate otomatis. Perbarui semua modul:

\`\`\`bash
npm run docs:modules
\`\`\`

**Diperbarui:** ${now}

| Modul | Key | File | Baris kode |
|-------|-----|------|------------|
${rows}

---

Setiap file modul berisi **salinan lengkap** seluruh baris kode \`.ts\` di folder modul tersebut (bukan ringkasan).
`;

  await writeFile(join(OUT_DIR, 'README.md'), index, 'utf8');
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const results = [];
  for (const [moduleKey, config] of Object.entries(MODULES)) {
    const result = await generateModuleDoc(moduleKey, config);
    results.push(result);
    console.log(
      `✓ ${moduleKey}.md — ${result.fileCount} file, ${result.totalLines} baris`,
    );
  }

  await generateIndex(results);
  console.log(`✓ README.md — index ${results.length} modul`);
  console.log(`\nSelesai. Output: docs/modules/`);
}

main().catch((err) => {
  console.error('Gagal generate dokumentasi modul:', err);
  process.exit(1);
});
