import esbuild from 'esbuild'

const production = process.argv[2] === 'production'

// Obsidian loads a single CommonJS file. Everything the host provides is
// external; only our own code and fflate are bundled.
const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  target: 'es2022',
  platform: 'browser',
  external: ['obsidian', 'electron', 'node:*'],
  sourcemap: production ? false : 'inline',
  minify: production,
  treeShaking: true,
  outfile: 'main.js',
  logLevel: 'info',
})

if (production) {
  await context.rebuild()
  await context.dispose()
} else {
  await context.watch()
}
