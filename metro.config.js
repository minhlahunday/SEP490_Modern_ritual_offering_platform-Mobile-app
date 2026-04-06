const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const { resolver } = config;

resolver.sourceExts = [...new Set([...resolver.sourceExts, 'js', 'json', 'ts', 'tsx', 'mjs', 'cjs'])];

module.exports = config;
