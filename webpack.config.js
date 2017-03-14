var webpack = require('webpack');
var path = require("path");
let ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
  entry: [
      './src/index.js'
  ],
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel'
    }]
  },
  resolve: {
    extensions: ['', '.js']
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    publicPath: '/assets/', // It will serve the resources (entries) from public path (Relative to your server)
    filename: 'app.js'
  },
  devServer: {
    contentBase: './dist', // Path that will be served with resources
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify('development')
      },
      '__API__': JSON.stringify('http://localhost:8080')
    })                      
  ]
};
