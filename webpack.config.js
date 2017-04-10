var webpack = require('webpack');
var path = require("path");

var fs = require('fs');

var nodeModules = {};
fs.readdirSync('node_modules')
  .filter(function(x) {
    return ['.bin'].indexOf(x) === -1;
  })
  .forEach(function(mod) {
    nodeModules[mod] = 'commonjs ' + mod;
  });

module.exports = {
  entry: [
      './src/index.js'
  ],
  target: 'node',
  module: {
    // preLoaders: [
    //   {  
    //     test: /\.json$/,
    //     loader: 'json' // read *.json files properly when it is used as entry file
    //   }
    // ],
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
  externals: nodeModules
  // plugins: [
  //   new webpack.DefinePlugin({
  //     'process.env': {
  //       'NODE_ENV': JSON.stringify('development')
  //     },
  //     '__API__': JSON.stringify('http://localhost:8080')
  //   })                      
  // ]
};
