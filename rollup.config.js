import alias from 'rollup-plugin-strict-alias';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';

const { PRODUCTION } = process.env;

const plugins = [
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
  }),
  alias({
    'react': require.resolve('preact/compat'),
    'react-dom': require.resolve('preact/compat'),
  }),
  resolve({
    browser: true,
  }),
  replace({
    'process.env.NODE_ENV': JSON.stringify(PRODUCTION ? 'production' : 'development'),
  }),
  commonjs({
    exclude: '**/preact-use/**',
  }),
  commonjs({
    include: '**/preact-use/**',
    transformMixedEsModules: true,
  }),
];

if (PRODUCTION) {
  plugins.push(terser({
    // Preserve the names of the components, which are used for various purposes.
    keep_fnames: new RegExp([
      'ClosestSolution',
      'CorrectedAnswer',
      'SolutionListLink',
      'SolutionListModal',
    ].join('|'))
  }));
}

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/src/page.js',
    format: 'iife',
  },
  treeshake: true,
  plugins,
};
