import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "~/lib/api";
import {
  clinicianPatientsResponseSchema,
  getZodErrorMessage,
  signUpFormSchema,
  type ClinicianPatient,
} from "~/lib/validation";

export function ClinicianNewPatientPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<ClinicianPatient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [patientsError, setPatientsError] = useState("");
  const [patientPendingDeletion, setPatientPendingDeletion] =
    useState<ClinicianPatient | null>(null);
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setIsLoadingPatients(true);
        setPatientsError("");
        const response = await apiFetch("/api/clinician/patients");
        if (!response.ok) {
          throw new Error("טעינת רשימת המטופלים נכשלה");
        }

        const result = clinicianPatientsResponseSchema.safeParse(await response.json());
        if (!result.success) {
          throw new Error(getZodErrorMessage(result.error, "טעינת רשימת המטופלים נכשלה"));
        }

        setPatients(result.data.patients);
      } catch (err: unknown) {
        setPatientsError(
          err instanceof Error ? err.message : "טעינת רשימת המטופלים נכשלה",
        );
      } finally {
        setIsLoadingPatients(false);
      }
    })();
  }, []);

  const showDeleteButton = true;

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();

    const formResult = signUpFormSchema.safeParse({ username, email, password });
    if (!formResult.success) {
      setError(getZodErrorMessage(formResult.error, "יצירת המטופל/ת נכשלה"));
      setSuccessMessage("");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const {
        email: validEmail,
        password: validPassword,
        username: validUsername,
      } = formResult.data;
      const response = await apiFetch("/api/clinician/patients", {
        method: "POST",
        body: JSON.stringify({
          username: validUsername,
          email: validEmail,
          password: validPassword,
        }),
      });

      const responseData = (await response.json()) as {
        error?: string;
        user?: ClinicianPatient;
      };
      if (!response.ok) {
        throw new Error(responseData.error ?? "יצירת המטופל/ת נכשלה");
      }

      if (!responseData.user) {
        throw new Error("יצירת המטופל/ת נכשלה");
      }

      const createdPatient = responseData.user;
      setPatients((currentPatients) =>
        [...currentPatients, createdPatient].sort((left, right) =>
          left.username.localeCompare(right.username, "he"),
        ),
      );

      setUsername("");
      setEmail("");
      setPassword("");
      setSuccessMessage("המטופל/ת נוצר/ה בהצלחה");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "יצירת המטופל/ת נכשלה");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePatient = async () => {
    if (!patientPendingDeletion) {
      return;
    }

    setDeletingPatientId(patientPendingDeletion.id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await apiFetch(
        `/api/me?userId=${encodeURIComponent(patientPendingDeletion.id)}`,
        {
          method: "DELETE",
        },
      );

      const responseData = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(responseData.error ?? "מחיקת המשתמש נכשלה");
      }

      setPatients((currentPatients) =>
        currentPatients.filter((patient) => patient.id !== patientPendingDeletion.id),
      );
      setSuccessMessage("המשתמש נמחק בהצלחה");
      setPatientPendingDeletion(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "מחיקת המשתמש נכשלה");
    } finally {
      setDeletingPatientId(null);
    }
  };

  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center bg-white px-6 pt-16"
    >
      <div className="w-full max-w-sm">
        <Link
          to="/clinician-menu"
          className="inline-flex text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          חזרה לתפריט קלינאים
        </Link>
      </div>

      <h1 className="mt-6 text-2xl font-bold text-gray-900">הגדרת מטופל/ת חדש/ה</h1>

      {error && (
        <div className="mt-4 w-full max-w-sm rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 w-full max-w-sm rounded-lg bg-green-50 p-3 text-center text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleCreatePatient} className="mt-8 w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            שם משתמש
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="בחר שם משתמש"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            אימייל
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="your@email.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            סיסמה
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "יוצר..." : "יצירת מטופל/ת"}
        </button>
      </form>

      <section className="mt-12 w-full max-w-sm">
        <h2 className="text-lg font-bold text-gray-900">המטופלים שלי</h2>

        {isLoadingPatients ? (
          <p className="mt-3 text-sm text-gray-600">טוען מטופלים...</p>
        ) : patientsError ? (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {patientsError}
          </p>
        ) : patients.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">עדיין לא נוספו מטופלים.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{patient.username}</p>
                    <p className="mt-1 text-sm text-gray-600">{patient.email}</p>
                  </div>

                  {showDeleteButton && <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setSuccessMessage("");
                      setPatientPendingDeletion(patient);
                    }}
                    disabled={deletingPatientId === patient.id}
                    className="shrink-0 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingPatientId === patient.id ? "מוחק..." : "מחיקת משתמש"}
                  </button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {patientPendingDeletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">מחיקת משתמש</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              האם למחוק את המשתמש/ת <strong>{patientPendingDeletion.username}</strong>?
              פעולה זו תמחק את המשתמש גם מ-WorkOS ולא ניתן יהיה לשחזר אותה.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPatientPendingDeletion(null)}
                disabled={deletingPatientId !== null}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => void handleDeletePatient()}
                disabled={deletingPatientId !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingPatientId !== null ? "מוחק..." : "כן, למחוק"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
