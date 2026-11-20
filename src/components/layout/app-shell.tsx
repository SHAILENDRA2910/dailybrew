import { motion, MotionConfig } from "framer-motion";
import { Suspense, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Sidebar } from "@/components/layout/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

function PageFallback() {
  return (
    <div className="space-y-4 pt-2">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-44 w-full rounded-[24px]" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export function AppShell() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-ivory">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-espresso focus:px-4 focus:py-2.5 focus:text-[12px] focus:font-medium focus:text-ivory"
        >
          Skip to content
        </a>
        <Sidebar />
        <MobileHeader />
        <div className="lg:pl-[264px]">
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1180px] px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 focus:outline-none sm:px-6 sm:pt-6 lg:px-10 lg:pb-16 lg:pt-10"
          >
            <Suspense fallback={<PageFallback />}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            </Suspense>
          </main>
        </div>
        <BottomNav />
      </div>
    </MotionConfig>
  );
}
