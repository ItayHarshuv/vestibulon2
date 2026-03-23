import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";

export function Navbar() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  return (
    <nav
      className="border-b border-gray-200 bg-white"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-gray-900">
              Vestibulon
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {!user ? (
              <Link
                to="/sign-in"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                התחברות
              </Link>
            ) : (
              <>
                <span className="text-sm font-medium text-gray-700">{user.username}</span>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      await signOut();
                      void navigate("/sign-in");
                    })();
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
                >
                  התנתקות
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
