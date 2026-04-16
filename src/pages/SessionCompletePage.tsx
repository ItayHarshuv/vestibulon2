import { useNavigate } from "react-router-dom";

export function SessionCompletePage() {
  const navigate = useNavigate();

  return (
    <main
      dir="rtl"
      className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl bg-white px-4 py-8 sm:px-5"
    >
      <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center">
        <h1 className="text-center text-4xl font-extrabold text-gray-900 sm:text-6xl">
          כל הכבוד! השלמת תרגול שלם! זכית ב 1000 נקודות!
        </h1>

        <button
          type="button"
          onClick={() => {
            void navigate("/");
          }}
          className="mt-10 w-full max-w-xl rounded-lg bg-emerald-400 px-6 py-6 text-2xl font-extrabold text-white transition hover:bg-emerald-500 sm:text-4xl"
        >
          חזרה למסך הבית
        </button>
      </div>
    </main>
  );
}
