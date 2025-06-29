# Builder App Example

This is a complete Electron application built with **Electron Builder** and **electron-vite**, demonstrating how to use `wdio-electron-service` for end-to-end testing with a professional packaging setup.

## 🚀 Features

- **Electron Builder** for professional packaging and distribution
- **electron-vite** for fast development and building
- **ESM** main process with **CJS** preload script
- **Context isolation** and secure IPC communication
- **Application menu** with native OS integration
- **Comprehensive test suite** with builder-specific features

## 📦 What's Included

### Application Structure

```
src/
├── main/           # Main process (ESM)
│   └── index.js
├── preload/        # Preload scripts (CJS)
│   └── index.cjs
└── renderer/       # Renderer process
    └── index.html
```

### Test Features Demonstrated

- ✅ Builder-specific UI testing
- ✅ Menu system testing
- ✅ Window configuration validation
- ✅ Multi-option dialog testing
- ✅ App path and configuration access
- ✅ CSS Grid layout validation
- ✅ HTML content formatting tests

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build the app
pnpm build

# Package the app (without distribution)
pnpm pack

# Create distributable packages
pnpm dist

# Run tests
pnpm test
```

## 🧪 Testing

The test suite demonstrates builder-specific features:

1. **Builder Configuration** - Access to build settings and package info
2. **Menu System** - Testing native application menus
3. **Window Management** - Validation of window size and properties
4. **Advanced UI** - Grid layouts, backdrop filters, HTML formatting
5. **Distribution Features** - Testing packaged app characteristics

## 📋 When to Use This Setup

Choose **Electron Builder** when you want:

- Professional packaging and distribution
- Code signing and notarization
- Auto-updater functionality
- Multiple platform builds
- Custom installers (NSIS, DMG, etc.)
- Advanced build configurations

## 🔧 Configuration

### Builder Configuration

The builder configuration is in `package.json` under the `build` section:

- Custom app ID and product name
- Platform-specific build targets
- Output directory configuration
- File inclusion patterns

### electron-vite Configuration

See `electron.vite.config.js` for build configuration.

### WebDriverIO Configuration

See `wdio.conf.js` for test configuration. The service can auto-detect Builder output or use explicit paths.

## 🎯 Key Differences from Forge

- **Packaging Focus**: Builder is primarily about packaging, not development
- **Configuration**: More granular control over build process
- **Distribution**: Better support for app stores and auto-updates
- **Flexibility**: Works with any build tool (not just electron-vite)
- **Output Structure**: Different directory structure (`dist-electron/` vs `out/`)

## 🏗️ Build Output

Electron Builder creates:

```
dist-electron/
├── mac/
│   └── Builder App Example.app/
├── win/
│   └── Builder App Example.exe
└── linux/
    └── Builder App Example.AppImage
```

## 📱 Distribution

Builder supports:

- **macOS**: DMG, PKG, MAS (App Store)
- **Windows**: NSIS, Squirrel, MSI, AppX (Store)
- **Linux**: AppImage, deb, rpm, snap, flatpak
