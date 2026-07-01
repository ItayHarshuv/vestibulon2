import { useEffect, useRef, useState } from "react";
import { Link, matchPath, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";

function getPageTitle(pathname: string) {
  if (matchPath("/regular-menu", pathname)) return "תפריט";
  if (matchPath("/credits", pathname)) return "אודות";
  if (matchPath("/clinician-menu", pathname)) return "תפריט קלינאים";
  if (matchPath("/clinician-menu/new-patient", pathname)) return "הגדרת מטופל/ת חדש/ה";
  if (matchPath("/clinician-menu/treatment-plan", pathname)) {
    return "יצירת / שינוי תכנית טיפול למטופל/ת";
  }
  if (matchPath("/clinician-menu/messages", pathname)) {
    return "שליחת הודעות למטופל/ת";
  }
  if (matchPath("/schedule", pathname)) return "קביעת זמני תרגול";
  if (matchPath("/exercise-statistics", pathname)) return "נתוני התרגול";
  if (matchPath("/select-exercise", pathname)) return "בחירת תרגיל";
  if (matchPath("/select-previous-session", pathname)) return "השלמת תרגולים קודמים";
  if (matchPath("/exercise-description/:prescribedExerciseId", pathname)) return "תיאור התרגיל";
  if (matchPath("/workout/:prescribedExerciseId", pathname)) return "תרגול";
  if (matchPath("/workout-finish/:prescribedExerciseId/:performedRepId", pathname)) return "סיום תרגול";
  if (matchPath("/workout-rest/:prescribedExerciseId/:performedRepId", pathname)) return "מנוחה";
  if (matchPath("/session-complete", pathname)) return "התרגול הושלם";
  if (matchPath("/sign-in", pathname)) return "התחברות";
  if (matchPath("/sign-up", pathname)) return "הרשמה";

  return "";
}

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [displayedPoints, setDisplayedPoints] = useState(user?.points ?? 0);
  const displayedPointsRef = useRef(displayedPoints);
  const isHomePage = location.pathname === "/";
  const pageTitle = getPageTitle(location.pathname);
  const shouldHideBackButton =
    matchPath("/workout/:prescribedExerciseId", location.pathname) !== null ||
    matchPath("/workout-finish/:prescribedExerciseId/:performedRepId", location.pathname) !== null ||
    matchPath("/workout-rest/:prescribedExerciseId/:performedRepId", location.pathname) !== null ||
    matchPath("/session-complete", location.pathname) !== null;

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
            {isHomePage ? (
              <>
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
              </>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>

          <div className="flex items-center justify-self-end gap-4">
            {!user && isHomePage ? (
              <Link
                to="/sign-in"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                התחברות
              </Link>
            ) : (
              <>
                {user && isHomePage ? (
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
                ) : (
                  <>
                    <span className="text-lg font-bold text-gray-900 sm:text-xl">
                      {pageTitle}
                    </span>
                    {!shouldHideBackButton && (
                      <button
                        type="button"
                        aria-label="Go back"
                        onClick={() => {
                          if (window.history.length > 1) {
                            void navigate(-1);
                            return;
                          }

                          void navigate("/");
                        }}
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
                          className="h-8 w-8"
                          aria-hidden="true"
                        >
                          <path d="M5 12h14" />
                          <path d="M13 6l6 6-6 6" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
