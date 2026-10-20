import { AppBoundary } from "./components/AppBoundary";
import { LandingPage } from "./components/LandingPage";

export default function App() {
  return (
    <AppBoundary>
      <LandingPage />
    </AppBoundary>
  );
}
