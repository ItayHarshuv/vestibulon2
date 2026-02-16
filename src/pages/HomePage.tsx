import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { HomeActionButton } from "../components/HomeActionButton";

export function HomePage() {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [selectedGender, setSelectedGender] = useState<"male" | "female" | null>(
    null,
  );
  const [isSavingGender, setIsSavingGender] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasGenderInMetadata = useMemo(() => {
    const unsafeGender = user?.unsafeMetadata?.gender;
    const publicGender = user?.publicMetadata?.gender;
    return (
      unsafeGender === "male" ||
      unsafeGender === "female" ||
      publicGender === "male" ||
      publicGender === "female"
    );
  }, [user?.publicMetadata?.gender, user?.unsafeMetadata?.gender]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setShowGenderModal(false);
      return;
    }
    setShowGenderModal(!hasGenderInMetadata);
  }, [hasGenderInMetadata, isLoaded, user]);

  async function handleConfirmGender() {
    if (!user || !selectedGender) return;
    try {
      setIsSavingGender(true);
      setSaveError(null);
      await user.update({
        unsafeMetadata: {
          ...(user.unsafeMetadata as Record<string, unknown>),
          gender: selectedGender,
        },
      });
      setShowGenderModal(false);
    } catch (error) {
      setSaveError("שמירת לשון הפנייה נכשלה. נסה שוב.");
    } finally {
      setIsSavingGender(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center bg-white px-6 pt-10"
    >

      {/* Top status text */}
      <p className="text-lg font-semibold text-gray-800">
        14:15
      </p>

      {/* Call to action */}
      <p className="mt-4 text-xl font-bold text-gray-900">
        <span className="underline">הגיע</span> הזמן לתרגל!
      </p>

      {/* Button cards */}
      <div className="mt-8 flex w-full max-w-lg flex-col gap-5">
        <HomeActionButton
          to="/"
          label="קביעת זמני תרגול"
          iconSrc="/assets/icons/clock.svg"
        />
        <HomeActionButton
          to="/"
          label="צפייה בנתוני התרגול"
          iconSrc="/assets/icons/bars-chart.svg"
        />
        <HomeActionButton
          to="/"
          label="הודעות מקלינאים"
          iconSrc="/assets/icons/messages.svg"
        />
      </div>

      {/* Start practice button */}
      <div className="mt-12 flex flex-col items-center">
        <button
          type="button"
          onClick={() => navigate("/select-exercise")}
          className="flex h-48 w-48 items-center justify-center rounded-full bg-green-500 text-center text-2xl font-extrabold text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-600"
        >
          התחלת
          <br />
          תרגול
        </button>
      </div>

      {showGenderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 text-right shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900">
              שלום! איזה כיף שהצטרפת. מה לשון הפנייה המועדף עליך?
            </h2>

            <fieldset className="mt-6 space-y-4">
              <label className="flex cursor-pointer items-center gap-3 text-xl font-semibold text-gray-900">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={selectedGender === "male"}
                  onChange={() => setSelectedGender("male")}
                  className="h-5 w-5 accent-green-600"
                />
                <span>גבר</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 text-xl font-semibold text-gray-900">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={selectedGender === "female"}
                  onChange={() => setSelectedGender("female")}
                  className="h-5 w-5 accent-green-600"
                />
                <span>אישה</span>
              </label>
            </fieldset>

            {saveError && (
              <p className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700">
                {saveError}
              </p>
            )}

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  void handleConfirmGender();
                }}
                disabled={!selectedGender || isSavingGender}
                className="rounded-lg bg-green-500 px-10 py-3 text-2xl font-bold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
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
