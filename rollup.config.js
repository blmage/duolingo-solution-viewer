import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';
import { terser } from 'rollup-plugin-terser';

const { PRODUCTION } = process.env;

const plugins = [
    babel({
        exclude: 'node_modules/**'
    }),
    resolve({
        browser: true
    }),
    replace({
        'process.env.NODE_ENV': JSON.stringify(PRODUCTION ? 'production' : 'development')
    }),
    commonjs()
];

if (PRODUCTION) {
    plugins.push(
        terser({
            // Preserve the names of the components, which are used for various purposes.
            keep_fnames: new RegExp([
                'ClosestSolution',
                'SolutionListLink',
                'SolutionListModal',
            ].join('|'))
        }),
    );
}

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/src/page.js',
        format: 'iife',
    },
    plugins
};
