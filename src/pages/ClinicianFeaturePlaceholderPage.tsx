import { Link } from "react-router-dom";

type ClinicianFeaturePlaceholderPageProps = {
  title: string;
};

export function ClinicianFeaturePlaceholderPage({
  title,
}: ClinicianFeaturePlaceholderPageProps) {
  return (
    <main dir="rtl" className="flex min-h-screen justify-center bg-white px-6 py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-gray-50 p-8 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-4 text-lg text-gray-600">עמוד זה מוכן להמשך פיתוח.</p>
        <Link
          to="/clinician-menu"
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          חזרה לתפריט קלינאים
        </Link>
      </div>
    </main>
  );
}
