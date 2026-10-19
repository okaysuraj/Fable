import type { ConfigContext, ExpoConfig } from 'expo/config';

// Keep identifiers configurable: choosing someone else's reverse-DNS namespace
// would make signing and future store updates unnecessarily difficult.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || 'Fable',
  slug: config.slug || 'fable',
  ios: {
    ...config.ios,
    ...(process.env.IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER } : {}),
  },
  android: {
    ...config.android,
    ...(process.env.ANDROID_APPLICATION_ID ? { package: process.env.ANDROID_APPLICATION_ID } : {}),
  },
  extra: {
    ...config.extra,
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
});
