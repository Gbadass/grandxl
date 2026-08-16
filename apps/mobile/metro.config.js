const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Monorepo: watch all workspace packages + pnpm virtual store
config.watchFolders = [
  ...(config.watchFolders ?? []),
  workspaceRoot,
  path.resolve(workspaceRoot, 'node_modules/.pnpm'),
]

// Monorepo: resolve from workspace root first, then project
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

// pnpm uses symlinks — Metro must follow them
config.resolver.unstable_enableSymlinks = true

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Shim getDevServer to handle RN 0.81+ ES module export change
  if (moduleName === 'react-native/Libraries/Core/Devtools/getDevServer') {
    return {
      filePath: path.resolve(projectRoot, 'shims/getDevServer.js'),
      type: 'sourceFile',
    }
  }

  // Resolve @grandxl/* workspace packages directly from TypeScript source.
  // Without this, Metro loads the compiled dist/ output and won't pick up
  // source changes until you manually rebuild each package.
  if (moduleName.startsWith('@grandxl/')) {
    const pkgName = moduleName.replace('@grandxl/', '')
    const srcEntry = path.resolve(workspaceRoot, 'packages', pkgName, 'src', 'index.ts')
    if (fs.existsSync(srcEntry)) {
      return { filePath: srcEntry, type: 'sourceFile' }
    }
  }

  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
