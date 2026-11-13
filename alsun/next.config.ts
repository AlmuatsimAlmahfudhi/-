import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // مكتبة libsql أصلية (native) فلا تُحزَم داخل الخادم
  serverExternalPackages: ["@libsql/client", "libsql"],
  // السماح بفتح الموقع من الهاتف/الآيباد عبر الشبكة المحلية أثناء التطوير
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*", "*.local"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
