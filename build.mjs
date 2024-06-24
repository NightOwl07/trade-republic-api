import dts from 'bun-plugin-dts'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './types',
  minify: true,
  plugins: [dts()]
})