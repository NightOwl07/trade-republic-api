import dts from 'bun-plugin-dts'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './types',
  target: 'bun',
  minify: true,
  plugins: [dts()]
})