import { useNavigate } from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();

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
        {/* קביעת זמני תרגול */}
        <button className="flex items-center justify-between rounded-lg border-2 border-blue-500 px-6 py-5 text-right transition-colors hover:bg-blue-50">
          <span className="text-lg font-semibold text-gray-800">
            קביעת זמני תרגול
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </button>

        {/* צפייה בנתוני התרגול */}
        <button className="flex items-center justify-between rounded-lg border-2 border-blue-500 px-6 py-5 text-right transition-colors hover:bg-blue-50">
          <span className="text-lg font-semibold text-gray-800">
            צפייה בנתוני התרגול
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 20h18" />
            <rect x="5" y="10" width="3" height="10" rx="0.5" />
            <rect x="10.5" y="4" width="3" height="16" rx="0.5" />
            <rect x="16" y="8" width="3" height="12" rx="0.5" />
          </svg>
        </button>

        {/* הודעות מקלינאים */}
        <button className="flex items-center justify-between rounded-lg border-2 border-blue-500 px-6 py-5 text-right transition-colors hover:bg-blue-50">
          <span className="text-lg font-semibold text-gray-800">
            הודעות מקלינאים
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 4L12 13 2 4" />
          </svg>
        </button>
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
    </main>
  );
}
