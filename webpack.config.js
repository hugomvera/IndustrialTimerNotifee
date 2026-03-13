const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: path.resolve(__dirname, 'index.web.js'), // Use our new web entry!
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: { loader: 'babel-loader' },
      },
    ],
  },
  resolve: {
    alias: {
      'react-native$': 'react-native-web', // Tells webpack to use the web version of RN
      'react-native-sound$': path.resolve(__dirname, 'SoundMock.js'),
    },
    extensions: ['.web.js', '.js'],
  },
  plugins: [new HtmlWebpackPlugin({ template: './public/index.html' })],
  devServer: {
    port: 8080,
  },
};
