import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import { Navbar } from "./components/Navbar";
import { HomePage } from "./pages/HomePage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";

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
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  );
}
