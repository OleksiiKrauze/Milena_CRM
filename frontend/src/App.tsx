import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { BottomNav } from '@/components/layout/BottomNav';

// Pages - will be created next
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CasesListPage } from '@/pages/CasesListPage';
import { CaseDetailsPage } from '@/pages/CaseDetailsPage';
import { CreateCasePage } from '@/pages/CreateCasePage';
import { EditCasePage } from '@/pages/EditCasePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { UsersListPage } from '@/pages/UsersListPage';
import { UserDetailsPage } from '@/pages/UserDetailsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { RolesManagementPage } from '@/pages/RolesManagementPage';
import { DirectionsManagementPage } from '@/pages/DirectionsManagementPage';
import { SearchListPage } from '@/pages/SearchListPage';
import { CreateSearchPage } from '@/pages/CreateSearchPage';
import { SearchDetailsPage } from '@/pages/SearchDetailsPage';
import { EditSearchPage } from '@/pages/EditSearchPage';
import { FieldSearchListPage } from '@/pages/FieldSearchListPage';
import { FieldSearchDetailsPage } from '@/pages/FieldSearchDetailsPage';
import { CreateFieldSearchPage } from '@/pages/CreateFieldSearchPage';
import { EditFieldSearchPage } from '@/pages/EditFieldSearchPage';
import { CreateEventPage } from '@/pages/CreateEventPage';
import { EventDetailsPage } from '@/pages/EventDetailsPage';
import { EditEventPage } from '@/pages/EditEventPage';

// Protected route wrapper
interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}

// Public route wrapper (redirects to home if already authenticated)
function PublicRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases"
            element={
              <ProtectedRoute>
                <CasesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/new"
            element={
              <ProtectedRoute>
                <CreateCasePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id/edit"
            element={
              <ProtectedRoute>
                <EditCasePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id"
            element={
              <ProtectedRoute>
                <CaseDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:caseId/create-search"
            element={
              <ProtectedRoute>
                <CreateSearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/searches"
            element={
              <ProtectedRoute>
                <SearchListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/searches/:id"
            element={
              <ProtectedRoute>
                <SearchDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/searches/:id/edit"
            element={
              <ProtectedRoute>
                <EditSearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/field-searches"
            element={
              <ProtectedRoute>
                <FieldSearchListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/field-searches/:id"
            element={
              <ProtectedRoute>
                <FieldSearchDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/field-searches/:id/edit"
            element={
              <ProtectedRoute>
                <EditFieldSearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/searches/:searchId/create-field-search"
            element={
              <ProtectedRoute>
                <CreateFieldSearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/searches/:searchId/create-event"
            element={
              <ProtectedRoute>
                <CreateEventPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:id"
            element={
              <ProtectedRoute>
                <EventDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:id/edit"
            element={
              <ProtectedRoute>
                <EditEventPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <UsersListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users/:id"
            element={
              <ProtectedRoute>
                <UserDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/roles"
            element={
              <ProtectedRoute>
                <RolesManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/directions"
            element={
              <ProtectedRoute>
                <DirectionsManagementPage />
              </ProtectedRoute>
            }
          />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
