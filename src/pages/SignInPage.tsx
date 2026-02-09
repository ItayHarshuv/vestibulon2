import { useState } from "react";
import { useSignIn } from "@clerk/clerk-react";
import { Link, useNavigate } from "react-router-dom";

export function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn || !isLoaded) return;

    setLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier: username,
        password,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        navigate("/");
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(clerkError.errors?.[0]?.message ?? "ההתחברות נכשלה");
    } finally {
      setLoading(false);
    }
  };

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

      <form
        onSubmit={handleSignIn}
        className="mt-8 w-full max-w-sm space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700">
            שם משתמש
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-right focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-right focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="••••••••"
            required
          />
        </div>

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
