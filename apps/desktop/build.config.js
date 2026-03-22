import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plugin to handle __dirname and __filename in CJS output
const dirnameFilenamePlugin = {
  name: 'dirname-filename',
  setup(build) {
    build.onLoad({ filter: /main\.mjs$/ }, async (args) => {
      const fs = await import('fs');
      let contents = fs.readFileSync(args.path, 'utf8');
      
      // Replace import.meta.url with a fallback for CJS
      contents = contents.replace(
        /const __filename = fileURLToPath\(import\.meta\.url\);/,
        `const __filename = typeof import.meta !== 'undefined' ? fileURLToPath(import.meta.url) : __filename;`
      );
      
      return { contents, loader: 'js' };
    });
  },
};

// Build configuration for Electron main process
const buildConfig = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs', // Changed to CommonJS for Electron compatibility
  sourcemap: true,
  external: [
    'electron',
    'better-sqlite3',
  ],
  tsconfig: './tsconfig.json',
  // Resolve .ts files when importing with .js extension
  resolveExtensions: ['.ts', '.js'],
  // Use plugins
  plugins: [dirnameFilenamePlugin],
};

async function buildMain() {
  try {
    await build({
      ...buildConfig,
      entryPoints: ['./main.ts'],
      outfile: './dist/main.cjs',
    });
    console.log('✓ Electron main process built successfully');
  } catch (error) {
    console.error('✗ Failed to build main process:', error);
    process.exit(1);
  }
}

async function buildPreload() {
  try {
    await build({
      ...buildConfig,
      entryPoints: ['./preload.ts'],
      outfile: './dist/preload.cjs',
    });
    console.log('✓ Electron preload script built successfully');
  } catch (error) {
    console.error('✗ Failed to build preload script:', error);
    process.exit(1);
  }
}

// Run builds
if (process.argv.includes('--watch')) {
  // Watch mode - rebuild on changes
  console.log('Building in watch mode...');
  
  const mainContext = await build({
    ...buildConfig,
    entryPoints: ['./main.ts'],
    outfile: './dist/main.cjs',
    watch: true,
  });
  
  const preloadContext = await build({
    ...buildConfig,
    entryPoints: ['./preload.ts'],
    outfile: './dist/preload.cjs',
    watch: true,
  });
  
  console.log('Watching for changes...');
} else {
  // One-time build
  await buildMain();
  await buildPreload();
}
