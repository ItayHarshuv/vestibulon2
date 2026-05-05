import { Link } from "react-router-dom";

export function RegularMenuPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-white px-6 py-10 text-center">
      <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-gray-50 p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">Regular Menu</h1>
        <p className="mt-4 text-lg text-gray-600">
          This page is ready for your regular menu content.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
