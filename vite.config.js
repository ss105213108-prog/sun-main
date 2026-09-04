import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url));
const CLASSIC_SCRIPT_DIR = path.join(ROOT_DIR, 'js');
const SOURCE_ASSET_DIR = path.join(ROOT_DIR, 'assets');
const OUTPUT_DIR = path.join(ROOT_DIR, 'dist');
const BROWSER_ASSET_EXTENSIONS = new Set(['.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

async function copyClassicScripts() {
  const outputScriptDir = path.join(OUTPUT_DIR, 'js');
  await mkdir(outputScriptDir, { recursive: true });

  const entries = await readdir(CLASSIC_SCRIPT_DIR, { withFileTypes: true });
  const scriptNames = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'backend-bootstrap.js')
    .map(entry => entry.name);

  await Promise.all(scriptNames.map(name => copyFile(
    path.join(CLASSIC_SCRIPT_DIR, name),
    path.join(outputScriptDir, name)
  )));

  return scriptNames;
}

async function copyBrowserAssets(sourceDir, outputDir) {
  await mkdir(outputDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'raw_references') continue;

    const sourcePath = path.join(sourceDir, entry.name);
    const outputPath = path.join(outputDir, entry.name);
    if (entry.isDirectory()) {
      await copyBrowserAssets(sourcePath, outputPath);
    } else if (BROWSER_ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      await copyFile(sourcePath, outputPath);
    }
  }
}

function preserveClassicRuntimePlugin() {
  return {
    name: 'preserve-classic-game-runtime',
    apply: 'build',
    async closeBundle() {
      const scripts = await copyClassicScripts();
      await copyBrowserAssets(SOURCE_ASSET_DIR, path.join(OUTPUT_DIR, 'assets'));

      if (scripts.length !== 12) {
        throw new Error(`Expected 12 classic game scripts, copied ${scripts.length}.`);
      }
    }
  };
}

export default defineConfig({
  plugins: [preserveClassicRuntimePlugin()],
  build: {
    rollupOptions: {
      preserveEntrySignatures: 'strict',
      input: {
        app: path.join(ROOT_DIR, 'index.html'),
        'supabase-client': path.join(ROOT_DIR, 'js', 'lib', 'supabase-client.js')
      }
    }
  }
});
