const webpackMerge = require('webpack-merge');
const commonConfig = require('./webpack.common.js');
const abs = require("./helpers")
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = webpackMerge(commonConfig, {
    mode: 'development',

    devtool: "cheap-module-eval-source-map",

    entry: {
        main: './test/main-dev.ts'
    },

    output: {
        path: abs(__dirname, "./dist"), // this path doesn't have any effect since in dev, we serve from memory (webpack-serve)
        publicPath: '/',
        filename: '[name].js',
        chunkFilename: '[id].[name].chunk.js'
    },

    module: {
        rules: [
            {
				test: /\.ts$/,
                loaders: [
                    'angular2-template-loader'
                    , 'awesome-typescript-loader'
                    , 'angular-router-loader?loader=require&genDir=compiled&debug=true'
                ],
				exclude: /node_modules/
            }
        ]
    },

    resolve: {
		extensions: [ '.tsx', '.ts', '.js','scss', 'css', 'woff', 'woff2', 'ttf', 'otf', 'eot' ],
        mainFields: ['browser', 'module', 'main']
    },
    
    plugins: [
        new HtmlWebpackPlugin({
			template: './test/index.html'
        })
    ]
});