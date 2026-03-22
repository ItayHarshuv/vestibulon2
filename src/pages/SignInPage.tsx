import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";
import { apiFetch } from "~/lib/api";
import {
  getZodErrorMessage,
  signInFormSchema,
} from "~/lib/validation";

export function SignInPage() {
  const { refreshSession } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const formResult = signInFormSchema.safeParse({ username, password });
    if (!formResult.success) {
      setError(getZodErrorMessage(formResult.error, "ההתחברות נכשלה"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { password: validPassword, username: validUsername } =
        formResult.data;
      const response = await apiFetch("/api/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({
          username: validUsername,
          password: validPassword,
        }),
      });

      const responseData = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(responseData.error ?? "ההתחברות נכשלה");
      }

      await refreshSession();
      void navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ההתחברות נכשלה");
    } finally {
      setLoading(false);
    }
  };

  async function handlePasswordReset() {
    if (!username.trim()) {
      setError("יש להזין שם משתמש או אימייל כדי לאפס סיסמה");
      return;
    }

    try {
      setIsResettingPassword(true);
      setError("");
      setResetMessage("");

      const response = await apiFetch("/api/auth/password-reset", {
        method: "POST",
        body: JSON.stringify({
          identifier: username,
        }),
      });

      const responseData = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(responseData.error ?? "שליחת קישור האיפוס נכשלה");
      }

      setResetMessage(
        responseData.message ??
          "אם קיים חשבון תואם, נשלח אימייל לאיפוס הסיסמה.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "שליחת קישור האיפוס נכשלה");
    } finally {
      setIsResettingPassword(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center bg-white px-6 pt-16"
    >
      <h1 className="text-2xl font-bold text-gray-900">התחברות</h1>

      {error && (
        <div className="mt-4 w-full max-w-sm rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      {resetMessage && (
        <div className="mt-4 w-full max-w-sm rounded-lg bg-emerald-50 p-3 text-center text-sm text-emerald-700">
          {resetMessage}
        </div>
      )}

      <form onSubmit={handleSignIn} className="mt-8 w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            שם משתמש
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-right focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            placeholder="שם המשתמש שלך"
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
          type="button"
          onClick={() => {
            void handlePasswordReset();
          }}
          disabled={isResettingPassword}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          {isResettingPassword ? "שולח..." : "שכחתי סיסמה"}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "מתחבר..." : "התחברות"}
        </button>
      </form>

      <p className="mt-8 text-sm text-gray-600">
        אין לך חשבון?{" "}
        <Link
          to="/sign-up"
          className="font-semibold text-blue-600 hover:text-blue-800"
        >
          הרשמה
        </Link>
      </p>
    </main>
  );
}
