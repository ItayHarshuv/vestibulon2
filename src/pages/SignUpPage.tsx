import { useState } from "react";
import { useSignUp } from "@clerk/clerk-react";
import { Link, useNavigate } from "react-router-dom";
import {
  clerkErrorSchema,
  getZodErrorMessage,
  signUpFormSchema,
} from "~/lib/validation";

export function SignUpPage() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp || !isLoaded) return;

    const formResult = signUpFormSchema.safeParse({ username, password });
    if (!formResult.success) {
      setError(getZodErrorMessage(formResult.error, "ההרשמה נכשלה"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { password: validPassword, username: validUsername } =
        formResult.data;
      const result = await signUp.create({
        username: validUsername,
        password: validPassword,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        void navigate("/");
      }
    } catch (err: unknown) {
      const clerkErrorResult = clerkErrorSchema.safeParse(err);
      setError(clerkErrorResult.data?.errors?.[0]?.message ?? "ההרשמה נכשלה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      dir="rtl"
      className="flex min-h-screen flex-col items-center bg-white px-6 pt-16"
    >
      <h1 className="text-2xl font-bold text-gray-900">הרשמה</h1>

      {error && (
        <div className="mt-4 w-full max-w-sm rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSignUp} className="mt-8 w-full max-w-sm space-y-4">
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
          {loading ? "נרשם..." : "הרשמה"}
        </button>
      </form>

      <p className="mt-8 text-sm text-gray-600">
        יש לך כבר חשבון?{" "}
        <Link
          to="/sign-in"
          className="font-semibold text-blue-600 hover:text-blue-800"
        >
          התחברות
        </Link>
      </p>
    </main>
  );
}
