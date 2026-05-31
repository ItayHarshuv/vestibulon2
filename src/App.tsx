import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Navbar } from "./components/Navbar";
import { HomePage } from "./pages/HomePage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { ClinicianNewPatientPage } from "./pages/ClinicianNewPatientPage";
import { ClinicianMenuPage } from "./pages/ClinicianMenuPage";
import { ClinicianFeaturePlaceholderPage } from "./pages/ClinicianFeaturePlaceholderPage";
import { ClinicianTreatmentPlanPage } from "./pages/ClinicianTreatmentPlanPage";
import { CreditsPage } from "./pages/CreditsPage";
import { ExerciseDescriptionPage } from "./pages/ExerciseDescriptionPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SelectExercisePage } from "./pages/SelectExercisePage";
import { SelectPreviousSessionPage } from "./pages/SelectPreviousSessionPage";
import { SessionCompletePage } from "./pages/SessionCompletePage";
import { RegularMenuPage } from "./pages/RegularMenuPage";
import { WorkoutPage } from "./pages/WorkoutPage";
import { WorkoutFinishPage } from "./pages/WorkoutFinishPage";
import { WorkoutRestPage } from "./pages/WorkoutRestPage";
import { ExerciseStatisticsPage } from "./pages/ExerciseStatisticsPage";

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-lg text-gray-700">
        טוען...
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-lg text-gray-700">
        טוען...
      </main>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function ClinicianOnly({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-lg text-gray-700">
        טוען...
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  if (user.role !== "clinician") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/regular-menu" element={<RegularMenuPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route
            path="/clinician-menu"
            element={
              <ClinicianOnly>
                <ClinicianMenuPage />
              </ClinicianOnly>
            }
          />
          <Route
            path="/clinician-menu/new-patient"
            element={
              <ClinicianOnly>
                <ClinicianNewPatientPage />
              </ClinicianOnly>
            }
          />
          <Route
            path="/clinician-menu/treatment-plan"
            element={
              <ClinicianOnly>
                <ClinicianTreatmentPlanPage />
              </ClinicianOnly>
            }
          />
          <Route
            path="/clinician-menu/messages"
            element={
              <ClinicianOnly>
                <ClinicianFeaturePlaceholderPage title="שליחת הודעות למטופל/ת" />
              </ClinicianOnly>
            }
          />
          <Route
            path="/schedule"
            element={
              <AuthGate>
                <SchedulePage />
              </AuthGate>
            }
          />
          <Route
            path="/exercise-statistics"
            element={
              <AuthGate>
                <ExerciseStatisticsPage />
              </AuthGate>
            }
          />
          <Route
            path="/select-exercise"
            element={
              <AuthGate>
                <SelectExercisePage />
              </AuthGate>
            }
          />
          <Route
            path="/select-previous-session"
            element={
              <AuthGate>
                <SelectPreviousSessionPage />
              </AuthGate>
            }
          />
          <Route
            path="/exercise-description/:programId"
            element={
              <AuthGate>
                <ExerciseDescriptionPage />
              </AuthGate>
            }
          />
          <Route
            path="/session-complete"
            element={
              <AuthGate>
                <SessionCompletePage />
              </AuthGate>
            }
          />
          <Route
            path="/workout/:programId"
            element={
              <AuthGate>
                <WorkoutPage />
              </AuthGate>
            }
          />
          <Route
            path="/workout-finish/:programId/:repId"
            element={
              <AuthGate>
                <WorkoutFinishPage />
              </AuthGate>
            }
          />
          <Route
            path="/workout-rest/:programId/:repId"
            element={
              <AuthGate>
                <WorkoutRestPage />
              </AuthGate>
            }
          />
          <Route
            path="/sign-in"
            element={
              <GuestOnly>
                <SignInPage />
              </GuestOnly>
            }
          />
          <Route
            path="/sign-up"
            element={
              <GuestOnly>
                <SignUpPage />
              </GuestOnly>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
