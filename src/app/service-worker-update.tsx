import { useEffect } from "react";
import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

export function ServiceWorkerUpdate() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (!("serviceWorker" in navigator)) return;

    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast("A fresh brew is ready.", {
          description: "Reload to pick up the latest DailyBrew version.",
          duration: Number.POSITIVE_INFINITY,
          action: {
            label: "Reload",
            onClick: () => {
              void updateServiceWorker(true);
            },
          },
        });
      },
      onOfflineReady() {
        toast.success("DailyBrew is ready offline.", {
          description: "Your ledger lives on this device.",
        });
      },
      onRegisterError(error) {
        console.error("DailyBrew service worker registration failed", error);
      },
    });
  }, []);

  return null;
}
