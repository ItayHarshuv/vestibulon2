import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import clinicianPatientsHandler from "./server/routes/clinician/patients";
import patientExportHandler from "./server/routes/clinician/patient-export";
import clinicianTreatmentPlanHandler from "./server/routes/clinician/treatment-plan";
import sessionHandler from "./server/routes/auth/session";
import signInHandler from "./server/routes/auth/sign-in";
import signOutHandler from "./server/routes/auth/sign-out";
import signUpHandler from "./server/routes/auth/sign-up";
import passwordResetHandler from "./server/routes/auth/password-reset";
import { callVercelApiHandler } from "./server/devAdapter";
import meHandler from "./api/me";
import performedRepsHandler from "./api/performed-reps";
import prescribedExercisesHandler from "./api/prescribed-exercises";
import todayRepsHandler from "./api/today-reps";
import exerciseStatisticsHandler from "./api/exercise-statistics";
import sessionTimesHandler from "./api/session-times";
import pushSubscriptionsHandler from "./server/routes/push/subscriptions";
import pushTestHandler from "./server/routes/push/test";
import pushRemindersHandler from "./api/cron/push-reminders";
import chatConversationsHandler from "./server/routes/chat/conversations";
import chatMessagesHandler from "./server/routes/chat/messages";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown;

export default defineConfig({
  plugins: [
    react(),
    {
      name: "api-plugin",
      configureServer(server) {
        const apiRoutes: Record<string, ApiHandler> = {
          "/clinician/patients": clinicianPatientsHandler,
          "/clinician/patient-export": patientExportHandler,
          "/clinician/treatment-plan": clinicianTreatmentPlanHandler,
          "/auth/session": sessionHandler,
          "/auth/sign-in": signInHandler,
          "/auth/sign-out": signOutHandler,
          "/auth/sign-up": signUpHandler,
          "/auth/password-reset": passwordResetHandler,
          "/me": meHandler,
          "/performed-reps": performedRepsHandler,
          "/prescribed-exercises": prescribedExercisesHandler,
          "/today-reps": todayRepsHandler,
          "/exercise-statistics": exerciseStatisticsHandler,
          "/session-times": sessionTimesHandler,
          "/push-subscriptions": pushSubscriptionsHandler,
          "/push-test": pushTestHandler,
          "/cron/push-reminders": pushRemindersHandler,
          "/chat/conversations": chatConversationsHandler,
          "/chat/messages": chatMessagesHandler,
        };

        server.middlewares.use("/api", (req, res, next) => {
          void (async () => {
            try {
              const requestUrl = new URL(req.url ?? "/", "http://localhost");
              const handler = apiRoutes[requestUrl.pathname];

              if (!handler) {
                next();
                return;
              }

              await callVercelApiHandler(req, res, handler);
            } catch (error) {
              console.error(
                "Error handling API route in Vite dev server:",
                error,
              );
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Internal server error" }));
              }
            }
          })();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
  },
});
