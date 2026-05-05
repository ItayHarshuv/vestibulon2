import { HomeActionButton } from "../components/HomeActionButton";

export function ClinicianMenuPage() {
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
          to="/clinician-menu/patient-practice-data"
          label="צפייה בנתוני תרגול של מטופל/ת"
          iconSrc="/assets/icons/bars-chart.svg"
        />
        <HomeActionButton
          to="/clinician-menu/messages"
          label="שליחת הודעות למטופל/ת"
          iconSrc="/assets/icons/messages.svg"
        />
      </div>
    </main>
  );
}
