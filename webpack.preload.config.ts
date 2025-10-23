import type { Configuration } from 'webpack';
import { preloadRules } from './webpack.preload.rules';

export const preloadConfig: Configuration = {
  module: {
    rules: preloadRules,
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx'],
  },
  target: 'electron-preload',
  externals: {
    electron: 'commonjs electron',
  },
};