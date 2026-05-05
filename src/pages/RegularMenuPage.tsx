import { useAuth } from "~/auth/AuthProvider";
import { HomeActionButton } from "../components/HomeActionButton";

export function RegularMenuPage() {
  const { user } = useAuth();

  return (
    <main dir="rtl" className="flex min-h-screen flex-col items-center bg-white px-6 py-10">
      <div className="flex w-full max-w-lg flex-col gap-5">
        <HomeActionButton to="/credits" label="אודות" />
        {user?.role === "clinician" && (
          <HomeActionButton
            to="/clinician-menu"
            label="תפריט קלינאים"
            iconSrc="/assets/icons/settings.svg"
          />
        )}
      </div>
    </main>
  );
}
