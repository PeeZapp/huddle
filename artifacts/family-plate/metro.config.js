const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /node_modules\/@firebase\/.*_tmp_\d+\/.*/,
  /node_modules\/\.pnpm\/@firebase\+.*_tmp_\d+\/.*/,
];

module.exports = config;

