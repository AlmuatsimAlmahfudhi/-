// يبني نسخة claude.ai: حزمة JS واحدة + CSS مضمّن في صفحة HTML
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const out = path.join(here, "dist");
mkdirSync(out, { recursive: true });
mkdirSync(path.join(here, ".gen"), { recursive: true });

// 1) بيانات ضربات الحروف الصينية المستعملة في المنهج
const chars = new Set();
for (const f of readdirSync(path.join(root, "src/content"))) for (const c of readFileSync(path.join(root, "src/content", f), "utf8").match(/\p{Script=Han}/gu) ?? []) chars.add(c);
const hz = {};
for (const c of chars) {
  const p = path.join(root, "node_modules/hanzi-writer-data", `${c}.json`);
  if (existsSync(p)) hz[c] = JSON.parse(readFileSync(p, "utf8"));
}
writeFileSync(path.join(here, ".gen/hanzi-data.json"), JSON.stringify(hz));
console.log("hanzi chars:", Object.keys(hz).length, "/", chars.size);

// 2) حزمة التطبيق
const alias = {
  "@/db": path.join(here, "db.ts"),
  "@/server/ai": path.join(here, "ai.ts"),
  "@/server/http": path.join(here, "http.ts"),
  "@/lib/api": path.join(here, "api.ts"),
  "@/lib/speech": path.join(here, "speech.ts"),
  "@/lib/backup": path.join(here, "backup.ts"),
  "@/hooks/useRecorder": path.join(here, "recorder.ts"),
  "@/hooks/useSpeechRecognition": path.join(here, "recognition.ts"),
  "@/hooks/useLiveConversation": path.join(here, "live.ts"),
  "next/link": path.join(here, "shims/next-link.tsx"),
  "next/navigation": path.join(here, "shims/next-navigation.ts"),
  "server-only": path.join(here, "shims/server-only.ts"),
  "hanzi-writer": path.join(here, "hanzi.ts"),
};
const aliasPlugin = {
  name: "alias",
  setup(b) {
    b.onResolve({ filter: /^node:/ }, (a) => ({ path: a.path, namespace: "empty" }));
    b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "export default {};", loader: "js" }));
    b.onResolve({ filter: /^(@\/|next\/|server-only$|hanzi-writer$)/ }, (a) => {
      if (alias[a.path] && !(a.path === "hanzi-writer" && a.importer.endsWith("hanzi.ts"))) return { path: alias[a.path] };
      return undefined;
    });
  },
};
await build({
  entryPoints: [path.join(here, "main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2022"],
  outfile: path.join(out, "app.js"),
  jsx: "automatic",
  loader: { ".sql": "text" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [aliasPlugin],
  logLevel: "warning",
  legalComments: "none",
  charset: "ascii",
});

// 3) CSS عبر Tailwind
const cssIn = path.join(here, ".gen/in.css");
writeFileSync(cssIn, readFileSync(path.join(root, "src/app/globals.css"), "utf8").replace('@import "tailwindcss";', '@import "tailwindcss";\n@source "../../src";\n@source "../";'));
execSync(`npx @tailwindcss/cli -i ${cssIn} -o ${path.join(out, "app.css")} --minify`, { cwd: root, stdio: "inherit" });

// 4) الصفحة
const css = readFileSync(path.join(out, "app.css"), "utf8");
const html = readFileSync(path.join(here, "page.html"), "utf8").replace("/*__CSS__*/", css);
writeFileSync(path.join(out, "index.html"), html);
console.log("app.js", (readFileSync(path.join(out, "app.js")).length / 1024).toFixed(0), "KB; index.html", (html.length / 1024).toFixed(0), "KB");
