
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import UpdatePassword from "./pages/UpdatePassword";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import AlertsPage from "./pages/Alerts";
import ProfilePage from "./pages/Profile";
import SettingsPage from "./pages/Settings"; // Import the new Settings page
import { ReactNode } from "react";

const queryClient = new QueryClient();

const GlobalAuthGuard = ({ children }: { children: ReactNode }) => {
  const { loading, isPasswordRecovery } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (isPasswordRecovery && location.pathname !== '/update-password') {
    return <Navigate to="/update-password" replace />;
  }

  return <>{children}</>;
};

const ProtectedRoute = () => {
  const { user, isPasswordRecovery } = useAuth();
  return user && !isPasswordRecovery ? <Outlet /> : <Navigate to="/auth" replace />;
};

const PublicRoute = () => {
  const { user, isPasswordRecovery } = useAuth();
  return !user || isPasswordRecovery ? <Outlet /> : <Navigate to="/" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <GlobalAuthGuard>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Index />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} /> {/* Add the new route */}
              </Route>
              <Route element={<PublicRoute />}>
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
              </Route>
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </GlobalAuthGuard>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
