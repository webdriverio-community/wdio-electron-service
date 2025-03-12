/**
 * This is a dummy forge config file to prevent errors when running no-binary tests.
 * The actual forge config files are in the individual app directories.
 */
module.exports = {
  packagerConfig: {
    name: 'dummy-app',
    executableName: 'dummy-app',
    appBundleId: 'com.dummy-app.app',
    appCategoryType: 'public.app-category.developer-tools',
    asar: true,
  },
  makers: [],
};
