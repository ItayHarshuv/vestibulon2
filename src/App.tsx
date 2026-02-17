import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { Navbar } from "./components/Navbar";
import { HomePage } from "./pages/HomePage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { ExerciseDescriptionPage } from "./pages/ExerciseDescriptionPage";
import { SelectExercisePage } from "./pages/SelectExercisePage";
import { WorkoutPage } from "./pages/WorkoutPage";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

export function App() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/select-exercise" element={<SelectExercisePage />} />
          <Route
            path="/exercise-description/:programId"
            element={<ExerciseDescriptionPage />}
          />
          <Route path="/workout/:programId" element={<WorkoutPage />} />
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  );
}
