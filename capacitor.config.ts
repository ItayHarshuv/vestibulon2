import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vestibulon2.app",
  appName: "Vestibulon",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    // On iOS WKWebView (especially with custom schemes like capacitor://),
    // `document.cookie` can be unavailable. This bridges cookies via native
    // storage so web auth SDKs can function.
    CapacitorCookies: {
      enabled: true,
    },
  },
};

export default config;
