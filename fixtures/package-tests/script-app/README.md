# Script App Example

This is a **minimal** Electron application using only npm scripts, demonstrating how to use `wdio-electron-service` for end-to-end testing without any build tools or complex configurations.

## 🚀 Features

- **Minimal setup** - Just Electron + npm scripts
- **No build tools** - Direct source execution
- **ESM** main process with **CJS** preload script
- **Context isolation** and security best practices
- **Clean, modern UI** with system-native styling
- **Comprehensive test suite** covering all aspects

## 📦 What's Included

### Application Structure

```
src/
├── main.js        # Main process (ESM)
├── preload.cjs    # Preload script (CJS)
└── index.html     # Renderer process
```

### Test Features Demonstrated

- ✅ Basic IPC communication testing
- ✅ Platform and version detection
- ✅ Security configuration validation
- ✅ UI state management testing
- ✅ Direct Electron API access
- ✅ Minimal API surface verification

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Start the app
pnpm start

# Run tests
pnpm test

# Run tests in headless mode
pnpm test:headless
```

## 🧪 Testing

The test suite demonstrates essential testing patterns:

1. **IPC Communication** - Testing main/renderer message passing
2. **Platform Detection** - Cross-platform compatibility testing
3. **Security Validation** - Context isolation and API surface
4. **UI Interactions** - Button clicks and state changes
5. **Direct API Access** - Electron API testing via service

## 📋 When to Use This Setup

Choose **Script-based setup** when you want:

- **Simplicity** - No build tools or complex configurations
- **Learning** - Understanding Electron fundamentals
- **Prototyping** - Quick experimentation and testing
- **Small projects** - Minimal overhead and dependencies
- **Development** - Fast iteration without build steps

## 🔧 Configuration

### Package.json

- **main**: Points to `src/main.js`
- **type**: Set to `"module"` for ESM support
- **scripts**: Minimal npm scripts for start and test

### WebDriverIO Configuration

See `wdio.conf.js` for test configuration. Uses:

- `appArgs: ['.']` to run the app directly
- No binary path needed - uses source files

### Security Configuration

- **Context Isolation**: ✅ Enabled
- **Node Integration**: ❌ Disabled
- **Preload Script**: Minimal API exposure
- **CSP**: Content Security Policy configured

## 🎯 Key Differences from Build Tools

- **No Build Step**: Run source files directly
- **No Bundling**: Files served as-is
- **No Transpilation**: Modern JS/HTML/CSS only
- **No Hot Reload**: Manual refresh needed
- **No Optimization**: Files not minified/optimized

## 🔍 What You'll Learn

This example teaches:

- **Electron Basics** - Core concepts without abstractions
- **IPC Patterns** - Main/renderer communication
- **Security Best Practices** - Context isolation setup
- **Testing Fundamentals** - E2E testing with WebDriverIO
- **Minimal Configuration** - Least possible setup

## 🚦 Getting Started

1. **Clone and install**:

   ```bash
   cd fixtures/package-tests/script-app
   pnpm install
   ```

2. **Run the app**:

   ```bash
   pnpm start
   ```

3. **Run tests**:
   ```bash
   pnpm test
   ```

## 💡 Next Steps

After mastering this setup, consider:

- **forge-app** - For official Electron toolchain
- **builder-app** - For professional packaging
- Adding TypeScript for better development experience
- Implementing auto-updater functionality
- Adding more sophisticated IPC patterns
