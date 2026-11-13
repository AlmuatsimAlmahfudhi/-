import { createRoot } from "react-dom/client";
import { Suspense, useMemo } from "react";
import { GameProvider } from "@/components/GameProvider";
import { BottomNav } from "@/components/BottomNav";
import Home from "@/app/page";
import LearnPage from "@/app/learn/page";
import ReviewPage from "@/app/review/page";
import SpeakPage from "@/app/speak/page";
import HeroPage from "@/app/hero/page";
import LessonPage from "@/app/lesson/[lang]/[lessonId]/page";
import { RouterProvider } from "./shims/router";
import { boot } from "./claude";
import { ready } from "./db";

function Lesson({ path }: { path: string }) {
  const [, , lang, id] = path.split("/");
  const params = useMemo(() => Promise.resolve({ lang, lessonId: id }), [lang, id]);
  return <LessonPage key={path} params={params} />;
}

function Page({ path }: { path: string }) {
  if (path.startsWith("/lesson/")) return <Lesson path={path} />;
  if (path === "/learn") return <LearnPage />;
  if (path === "/review") return <ReviewPage />;
  if (path === "/speak") return <SpeakPage />;
  if (path === "/hero") return <HeroPage />;
  return <Home />;
}

async function start() {
  const root = createRoot(document.getElementById("root")!);
  await boot();
  try {
    await ready();
  } catch (e) {
    root.render(<div style={{ padding: 24 }}>تعذّر تشغيل قاعدة البيانات: {String(e)}</div>);
    return;
  }
  document.getElementById("splash")?.remove();
  root.render(
    <RouterProvider>
      {(path) => (
        <GameProvider>
          <div className="mx-auto min-h-dvh w-full max-w-3xl pb-24">
            <Suspense fallback={<div className="p-10 text-center text-muted">…</div>}>
              <Page path={path} />
            </Suspense>
          </div>
          <BottomNav />
        </GameProvider>
      )}
    </RouterProvider>,
  );
}
start();
