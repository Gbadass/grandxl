// Self-contained replacement for RN's getDevServer.
// @expo/metro-runtime calls require(...)() expecting a CJS function.
// RN 0.81+ changed to ES module export default, breaking that call.
// This shim reimplements the same logic as a plain CJS export.

const FALLBACK = 'http://localhost:8081/'

let _cachedUrl
let _cachedFullUrl

function getDevServer() {
  if (_cachedUrl === undefined) {
    try {
      const { NativeModules } = require('react-native')
      const sc = NativeModules.SourceCode
      const scriptUrl = sc
        ? sc.getConstants
          ? sc.getConstants().scriptURL
          : sc.scriptURL
        : null
      const match = scriptUrl ? scriptUrl.match(/^https?:\/\/.*?\//) : null
      _cachedUrl = match ? match[0] : null
      _cachedFullUrl = match ? scriptUrl : null
    } catch (_) {
      _cachedUrl = null
      _cachedFullUrl = null
    }
  }

  return {
    url: _cachedUrl != null ? _cachedUrl : FALLBACK,
    fullBundleUrl: _cachedFullUrl,
    bundleLoadedFromServer: _cachedUrl !== null,
  }
}

module.exports = getDevServer
module.exports.default = getDevServer
