const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /node_modules\/.*_tmp_\d+\/.*/,
  /node_modules\/\.pnpm\/.*_tmp_\d+\/.*/,
];

module.exports = config;

