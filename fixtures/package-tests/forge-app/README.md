# Forge App Example

This is a complete Electron application built with **Electron Forge** and **electron-vite**, demonstrating how to use `wdio-electron-service` for end-to-end testing.

## 🚀 Features

- **Electron Forge** for building and packaging
- **electron-vite** for fast development and building
- **ESM** main process with **CJS** preload script
- **Context isolation** and secure IPC communication
- **Comprehensive test suite** showing all service features

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

- ✅ Basic UI testing
- ✅ Electron API execution via `browser.electron.execute()`
- ✅ API mocking with `browser.electron.mock()`
- ✅ IPC communication testing
- ✅ Window management
- ✅ Dialog interactions

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build the app
pnpm build

# Package the app
pnpm package

# Run tests
pnpm test
```

## 🧪 Testing

The test suite demonstrates all major features of `wdio-electron-service`:

1. **Basic Testing** - UI elements, titles, interactions
2. **Electron API Access** - Direct access to Electron APIs
3. **Mocking** - Mock Electron APIs for controlled testing
4. **IPC Testing** - Test main/renderer communication

## 📋 When to Use This Setup

Choose **Electron Forge** when you want:

- The "official" Electron toolchain
- Built-in packaging and distribution
- Simple, opinionated setup
- Great plugin ecosystem
- Auto-updater support

## 🔧 Configuration

### Forge Configuration

The Forge configuration is in `package.json` under the `config.forge` section.

### electron-vite Configuration

See `electron.vite.config.js` for build configuration.

### WebDriverIO Configuration

See `wdio.conf.js` for test configuration. The service will auto-detect the Forge build output.

## 🎯 Key Differences from Other Setups

- Uses Forge's opinionated project structure
- Automatic binary detection (no manual `appBinaryPath` needed)
- Built-in packaging and distribution tools
- Integrated with Forge's plugin system
