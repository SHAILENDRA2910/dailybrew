import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "@/app/routes";
import { Providers } from "@/app/providers";
import { ServiceWorkerUpdate } from "@/app/service-worker-update";

export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <ServiceWorkerUpdate />
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  );
}
