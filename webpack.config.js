export default [
    {
        output: {
            filename: 'jsspeccy/jsspeccy.js',
        },
        devtool: 'source-map',
        name: 'jsspeccy',
        entry: './runtime/jsspeccy.js',
        mode: 'production',
        module: {
            rules: [
                {
                    test: /\.svg$/,
                    loader: 'svg-inline-loader',
                }
            ],
        }
    },
    {
        output: {
            filename: 'jsspeccy/jsspeccy-worker.js',
        },
        devtool: 'source-map',
        name: 'worker',
        entry: './runtime/worker.js',
        mode: 'production',
    },
];
