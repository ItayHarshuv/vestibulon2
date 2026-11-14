import { useEffect, useRef, useState } from "react";
import { Link, matchPath, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "~/auth/AuthProvider";

function getPageTitle(pathname: string, isClinician: boolean) {
  if (matchPath("/regular-menu", pathname)) return "תפריט";
  if (matchPath("/credits", pathname)) return "אודות";
  if (matchPath("/clinician-menu", pathname)) return "תפריט קלינאים";
  if (matchPath("/clinician-menu/new-patient", pathname))
    return "הגדרת מטופל/ת חדש/ה";
  if (matchPath("/clinician-menu/treatment-plan", pathname)) {
    return "יצירת / שינוי תכנית טיפול למטופל/ת";
  }
  if (
    matchPath("/messages", pathname) ||
    matchPath("/clinician-menu/messages", pathname)
  ) {
    return isClinician ? "שליחת הודעה למטופל/ת" : "הודעות מקלינאים";
  }
  if (matchPath("/schedule", pathname)) return "קביעת זמני תרגול";
  if (matchPath("/exercise-statistics", pathname)) return "נתוני התרגול";
  if (matchPath("/select-exercise", pathname)) return "בחירת תרגיל";
  if (matchPath("/select-previous-session", pathname))
    return "השלמת תרגולים קודמים";
  if (matchPath("/exercise-description/:prescribedExerciseId", pathname))
    return "תיאור התרגיל";
  if (matchPath("/workout/:prescribedExerciseId", pathname)) return "תרגול";
  if (
    matchPath("/workout-finish/:prescribedExerciseId/:performedRepId", pathname)
  )
    return "סיום תרגול";
  if (
    matchPath("/workout-rest/:prescribedExerciseId/:performedRepId", pathname)
  )
    return "מנוחה";
  if (matchPath("/session-complete", pathname)) return "התרגול הושלם";
  if (matchPath("/sign-in", pathname)) return "התחברות";
  if (matchPath("/sign-up", pathname)) return "הרשמה";

  return "";
}

function getBackDestination(
  pathname: string,
  search: string,
  navigationState: unknown,
  isClinician: boolean,
) {
  if (matchPath("/regular-menu", pathname)) return "/";
  if (matchPath("/credits", pathname)) return "/regular-menu";
  if (matchPath("/clinician-menu", pathname)) return "/";
  if (matchPath("/clinician-menu/new-patient", pathname))
    return "/clinician-menu";
  if (matchPath("/clinician-menu/treatment-plan", pathname)) {
    return "/clinician-menu";
  }
  if (
    matchPath("/messages", pathname) ||
    matchPath("/clinician-menu/messages", pathname)
  ) {
    return isClinician ? "/clinician-menu" : "/";
  }
  if (matchPath("/schedule", pathname)) return "/";
  if (matchPath("/exercise-statistics", pathname)) {
    if (
      typeof navigationState === "object" &&
      navigationState !== null &&
      "backDestination" in navigationState &&
      (navigationState.backDestination === "/" ||
        navigationState.backDestination === "/clinician-menu")
    ) {
      return navigationState.backDestination;
    }

    return isClinician ? "/clinician-menu" : "/";
  }
  if (matchPath("/select-exercise", pathname)) return "/";
  if (matchPath("/select-previous-session", pathname)) return "/";
  if (matchPath("/exercise-description/:prescribedExerciseId", pathname)) {
    return `/select-exercise${search}`;
  }
  if (matchPath("/sign-in", pathname)) return "/";
  if (matchPath("/sign-up", pathname)) return "/sign-in";

  return "/";
}

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [displayedPoints, setDisplayedPoints] = useState(user?.points ?? 0);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const displayedPointsRef = useRef(displayedPoints);
  const isHomePage = location.pathname === "/";
  const pageTitle = getPageTitle(location.pathname, user?.role === "clinician");
  const shouldHideBackButton =
    matchPath("/workout/:prescribedExerciseId", location.pathname) !== null ||
    matchPath(
      "/workout-finish/:prescribedExerciseId/:performedRepId",
      location.pathname,
    ) !== null ||
    matchPath(
      "/workout-rest/:prescribedExerciseId/:performedRepId",
      location.pathname,
    ) !== null ||
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

    const animationDurationMs = Math.min(
      1600,
      600 + (nextPoints - startPoints) * 12,
    );
    const animationStart = performance.now();
    let animationFrameId = 0;

    const animate = (timestamp: number) => {
      const progress = Math.min(
        (timestamp - animationStart) / animationDurationMs,
        1,
      );
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
    <>
      <nav
        className="border-b border-gray-200 bg-white"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="flex items-center gap-2 justify-self-start">
              <span
                className="text-2xl leading-none text-yellow-400"
                aria-hidden="true"
              >
                ★
              </span>
              <span className="text-base font-semibold text-gray-900 tabular-nums">
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

            <div className="flex items-center gap-4 justify-self-end">
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
                      onClick={() => setShowLogoutConfirmation(true)}
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
                            void navigate(
                              getBackDestination(
                                location.pathname,
                                location.search,
                                location.state as unknown,
                                user?.role === "clinician",
                              ),
                            );
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

      {showLogoutConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirmation-title"
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-right shadow-xl"
            dir="rtl"
          >
            <h2
              id="logout-confirmation-title"
              className="text-lg font-bold text-gray-900"
            >
              התנתקות
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              האם את/ה בטוח/ה שברצונך להתנתק?
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setShowLogoutConfirmation(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirmation(false);
                  void (async () => {
                    await signOut();
                    void navigate("/sign-in");
                  })();
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                כן, להתנתק
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
