const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const webpack = require('webpack');

module.exports = {
    webpack: {
        configure: (webpackConfig) => {
            // Add NodePolyfillPlugin which handles most Node.js polyfills
            webpackConfig.plugins = [
                ...webpackConfig.plugins,
                new NodePolyfillPlugin(),
                new webpack.ProvidePlugin({
                    Buffer: ['buffer', 'Buffer'],
                    process: 'process/browser'
                })
            ];

            // Add any specific fallbacks that NodePolyfillPlugin might miss
            webpackConfig.resolve.fallback = {
                ...webpackConfig.resolve.fallback,
                "process": require.resolve("process/browser"),
                "path": require.resolve("path-browserify"),
                "fs": false
            };

            return webpackConfig;
        }
    }
};
