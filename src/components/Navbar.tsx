import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";

export function Navbar() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [displayedPoints, setDisplayedPoints] = useState(user?.points ?? 0);
  const displayedPointsRef = useRef(displayedPoints);

  useEffect(() => {
    displayedPointsRef.current = displayedPoints;
  }, [displayedPoints]);

  useEffect(() => {
    const nextPoints = user?.points ?? 0;
    const startPoints = displayedPointsRef.current;

    if (nextPoints <= startPoints) {
      setDisplayedPoints(nextPoints);
      return;
    }

    const animationDurationMs = Math.min(1600, 600 + (nextPoints - startPoints) * 12);
    const animationStart = performance.now();
    let animationFrameId = 0;

    const animate = (timestamp: number) => {
      const progress = Math.min((timestamp - animationStart) / animationDurationMs, 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      const animatedPoints = Math.round(
        startPoints + (nextPoints - startPoints) * easedProgress,
      );

      setDisplayedPoints(animatedPoints);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(animate);
      }
    };

    animationFrameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [user?.points]);

  return (
    <nav
      className="border-b border-gray-200 bg-white"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center gap-2 justify-self-start">
            <span className="text-2xl leading-none text-yellow-400" aria-hidden="true">
              ★
            </span>
            <span className="text-base font-semibold tabular-nums text-gray-900">
              {displayedPoints.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Link
              to="/regular-menu"
              aria-label="Open regular menu"
              className="rounded-md p-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </Link>
            <Link to="/" className="text-xl font-bold text-gray-900">
              Vestibulon
            </Link>
          </div>

          <div className="flex items-center justify-self-end gap-4">
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
