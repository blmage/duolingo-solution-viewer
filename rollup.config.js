import fs from 'fs';
import alias from 'rollup-plugin-strict-alias';
import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy'
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import css from 'rollup-plugin-purified-css';
import { terser } from 'rollup-plugin-terser';

const { PRODUCTION } = process.env;

const MANIFEST_VERSIONS = [ 'mv2', 'mv3' ];

const SOURCES = [
  'background',
  'content',
  'observer',
  'ui',
];

const BASE_PLUGINS = [
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
    preventAssignment: true,
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

const SOURCE_PLUGINS = {
  'common/ui': [
    css({
      output: 'dist/common/assets/css/ui.css',
    })
  ],
};

const DIST_PLUGINS = [
  copy({
    targets: MANIFEST_VERSIONS.map(mv => ({
      src: 'dist/common/*',
      dest: `dist/${mv}`,
    }))
  }),
];

const TERSER_CONFIG = {
  // Preserve the names of the components, which are used for various purposes.
  keep_fnames: new RegExp([
    'ChallengeSolutions',
    'ClosestSolution',
    'CorrectedAnswer',
    'SolutionLink',
    'SolutionList',
  ].join('|'))
};

const getSourcePlugins = (source, mv) => (
  BASE_PLUGINS
    .concat(SOURCE_PLUGINS[`${mv}/${source}`] || [])
    .concat(DIST_PLUGINS)
    .concat(PRODUCTION ? [ terser(TERSER_CONFIG) ] : [])
);

export default SOURCES.flatMap(source => {
  const configs = [];

  if (fs.existsSync(`src/common/${source}.js`)) {
    configs.push({
      treeshake: true,
      plugins: getSourcePlugins(source, 'common'),
      input: `src/common/${source}.js`,
      output: MANIFEST_VERSIONS.map(mv => ({
        file: `dist/${mv}/src/${source}.js`,
        format: 'iife',
      })),
    });
  } else {
    for (const mv of MANIFEST_VERSIONS) {
      configs.push({
        treeshake: true,
        plugins: getSourcePlugins(source, mv),
        input: `src/${mv}/${source}.js`,
        output: {
          file: `dist/${mv}/src/${source}.js`,
          format: 'iife',
        },
      });
    }
  }

  return configs;
});
