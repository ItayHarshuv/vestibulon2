import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vestibulon2.app",
  appName: "Vestibulon",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
