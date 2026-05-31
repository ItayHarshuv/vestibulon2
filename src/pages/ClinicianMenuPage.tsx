import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { HomeActionButton } from "../components/HomeActionButton";

export function ClinicianMenuPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [successModalMessage, setSuccessModalMessage] = useState<string | null>(null);

  useEffect(() => {
    const nextMessage =
      typeof location.state === "object" &&
      location.state !== null &&
      "successModalMessage" in location.state &&
      typeof location.state.successModalMessage === "string"
        ? location.state.successModalMessage
        : null;

    if (!nextMessage) {
      return;
    }

    setSuccessModalMessage(nextMessage);
    void navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  return (
    <main dir="rtl" className="flex min-h-screen flex-col items-center bg-white px-6 py-10">
      <div className="flex w-full max-w-lg flex-col gap-5">
        <HomeActionButton
          to="/clinician-menu/new-patient"
          label="הגדרת מטופל/ת חדש/ה"
          iconSrc="/assets/icons/settings.svg"
        />
        <HomeActionButton
          to="/clinician-menu/treatment-plan"
          label="יצירת / שינוי תכנית טיפול למטופל/ת"
          iconSrc="/assets/icons/checklist.svg"
          iconScale={1.4}
        />
        <HomeActionButton
          to="/exercise-statistics"
          label="צפייה בנתוני תרגול של מטופל/ת"
          iconSrc="/assets/icons/bars-chart.svg"
        />
        <HomeActionButton
          to="/clinician-menu/messages"
          label="שליחת הודעות למטופל/ת"
          iconSrc="/assets/icons/messages.svg"
        />
      </div>

      {successModalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">תכנית התרגול עודכנה</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">{successModalMessage}</p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSuccessModalMessage(null)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                אישור
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
