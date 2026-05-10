import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";

import { Landing } from "@/routes/index";
import { UnifiedLogin } from "@/routes/login";
import { SignupPage } from "@/routes/signup";
import { FacultyLayout } from "@/routes/faculty";
import { FacultyPage } from "@/routes/faculty.index";
import { FacultyStudentMarksPage } from "@/routes/faculty.students.$studentId";
import { FeesPortalPage } from "@/routes/fees";
import { HostelPortalPage } from "@/routes/hostel";
import { LibraryPortalPage } from "@/routes/library";
import { SuperAdminOutlet } from "@/routes/super-admin";
import { SuperAdminPage } from "@/routes/super-admin.index";
import { CredentialsPage } from "@/routes/super-admin.credentials";
import { GradeCardApplicationPage } from "@/routes/super-admin.grade-card-application";
import { SuperAdminStudentDetailPage } from "@/routes/super-admin.students.$studentId";
import { StudentDashboardPage } from "@/routes/student.dashboard";
import { StudentFeesPage } from "@/routes/student.fees";
import { StudentHostelPage } from "@/routes/student.hostel";
import { StudentLibraryPage } from "@/routes/student.library";
import { StudentCertificateFlowPage } from "@/routes/student.certificate-flow";
import { StudentMarksCardPage } from "@/routes/student.marks-card";
import { GradecardQrDownloadPage } from "@/routes/gradecard.download";

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster
        richColors
        position="top-right"
        closeButton
        toastOptions={{
          classNames: {
            closeButton:
              "h-6 w-6 border-0 bg-background/80 opacity-70 transition-opacity hover:opacity-100 [&>svg]:h-3.5 [&>svg]:w-3.5",
          },
          closeButtonAriaLabel: "Dismiss notification",
        }}
      />
    </>
  );
}

/** Preserves sub-routes and query when renaming top-level paths (e.g. /super-admin/credentials). */
function LegacyPathRedirect({ fromPrefix, toPrefix }: { fromPrefix: string; toPrefix: string }) {
  const { pathname, search, hash } = useLocation();
  const rest = pathname.startsWith(fromPrefix) ? pathname.slice(fromPrefix.length) : "";
  const dest =
    rest === "" || rest === "/"
      ? toPrefix
      : `${toPrefix.replace(/\/$/, "")}${rest.startsWith("/") ? rest : `/${rest}`}`;
  return <Navigate to={`${dest}${search}${hash}`} replace />;
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<Landing />} />
          <Route path="login" element={<UnifiedLogin />} />
          <Route path="signup" element={<SignupPage />} />

          <Route path="developer" element={<Navigate to="/admin-1" replace />} />
          <Route
            path="super-admin/*"
            element={<LegacyPathRedirect fromPrefix="/super-admin" toPrefix="/admin-1" />}
          />
          <Route
            path="faculty/*"
            element={<LegacyPathRedirect fromPrefix="/faculty" toPrefix="/admin-2" />}
          />
          <Route path="admin/login" element={<Navigate to="/login" replace />} />
          <Route path="student/login" element={<Navigate to="/login" replace />} />
          <Route
            path="admin/*"
            element={<LegacyPathRedirect fromPrefix="/admin" toPrefix="/admin-2" />}
          />
          <Route
            path="head-of-coe/*"
            element={<LegacyPathRedirect fromPrefix="/head-of-coe" toPrefix="/admin-1" />}
          />

          <Route path="admin-2" element={<FacultyLayout />}>
            <Route index element={<FacultyPage />} />
            <Route path="students/:studentId" element={<FacultyStudentMarksPage />} />
          </Route>

          <Route path="fees" element={<FeesPortalPage />} />
          <Route path="hostel" element={<HostelPortalPage />} />
          <Route path="library" element={<LibraryPortalPage />} />

          <Route path="admin-1" element={<SuperAdminOutlet />}>
            <Route index element={<SuperAdminPage />} />
            <Route path="credentials" element={<CredentialsPage />} />
            <Route path="grade-card-application" element={<GradeCardApplicationPage />} />
            <Route path="students/:studentId" element={<SuperAdminStudentDetailPage />} />
          </Route>

          <Route path="student/dashboard" element={<StudentDashboardPage />} />
          <Route path="student/fees" element={<StudentFeesPage />} />
          <Route path="student/hostel" element={<StudentHostelPage />} />
          <Route path="student/library" element={<StudentLibraryPage />} />
          <Route path="student/certificate-flow" element={<StudentCertificateFlowPage />} />
          <Route path="student/marks-card" element={<StudentMarksCardPage />} />
          <Route path="gradecard/download" element={<GradecardQrDownloadPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
