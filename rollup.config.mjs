import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';

export default [
	// JavaScript bundle
	{
		input: 'src/index.ts',
		output: [
			{ file: 'dist/index.js', format: 'es', sourcemap: true },
			{ file: 'dist/index.cjs', format: 'cjs', sourcemap: true, exports: 'named' },
		],
		plugins: [
			resolve(),
			commonjs(),
			typescript({ tsconfig: './tsconfig.json', declaration: false }),
			// Copy src/style.scss to dist/style.scss
			copy({ targets: [{ src: 'src/style.scss', dest: 'dist' }] }),
		],
		treeshake: true,
		onwarn(warning, warn) {
			if (warning.code === 'EMPTY_BUNDLE') return;
			warn(warning);
		},
	},
	// CSS bundle (processes src/style.scss to dist/style.css)
	{
		input: 'src/style.scss',
		output: {
			// No JS output needed for CSS-only bundle, but Rollup requires an output
			file: 'dist/style.js', // Dummy output file (will be empty)
			format: 'es',
		},
		plugins: [
			postcss({
				extract: 'style.css', // Output compiled CSS to dist/style.css
				minimize: true,
				sourceMap: true,
				extensions: ['.css', '.scss'],
				use: { sass: {} }, // Requires `sass` package
				plugins: [autoprefixer()],
			}),
		],
		// Suppress warnings about empty JS output for this CSS-only bundle
		onwarn(warning, warn) {
			if (warning.code === 'EMPTY_BUNDLE') return;
			warn(warning);
		},
	},
	// TypeScript declaration bundle
	{
		input: 'src/index.ts',
		output: { file: 'dist/index.d.ts', format: 'es' },
		plugins: [dts()],
	},
];
