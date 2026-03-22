import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Navbar } from "./components/Navbar";
import { HomePage } from "./pages/HomePage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { ExerciseDescriptionPage } from "./pages/ExerciseDescriptionPage";
import { SelectExercisePage } from "./pages/SelectExercisePage";
import { WorkoutPage } from "./pages/WorkoutPage";
import { WorkoutFinishPage } from "./pages/WorkoutFinishPage";
import { WorkoutRestPage } from "./pages/WorkoutRestPage";

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

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/select-exercise"
            element={
              <AuthGate>
                <SelectExercisePage />
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
