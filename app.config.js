// Expo Go loads an EAS Update only when its runtime version is Expo Go's own, "exposdk:<sdk>".
// scripts/publish-friends.js sets EXPO_GO_UPDATE to publish such an update for friends testing
// in Expo Go; store builds keep the appVersion runtime policy from app.json.
const { version } = require('expo/package.json');

module.exports = ({ config }) =>
  process.env.EXPO_GO_UPDATE
    ? { ...config, runtimeVersion: `exposdk:${version.split('.')[0]}.0.0` }
    : config;
