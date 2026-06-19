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
import { AdminOutlet } from "@/routes/admin";
import { AdminPage } from "@/routes/admin.index";
import { AdminStudentMarksPage } from "@/routes/admin.students.$studentId";
import { CoeOutlet } from "@/routes/coe";
import { CoePage } from "@/routes/coe.index";
import { CredentialsPage } from "@/routes/coe.credentials";
import { MarksConfigurationPage } from "@/routes/coe.marks-configuration";
import { GradeCardApplicationPage } from "@/routes/coe.grade-card-application";
import { CoeStudentDetailPage } from "@/routes/coe.students.$studentId";
import { FeesPortalPage } from "@/routes/fees";
import { HostelPortalPage } from "@/routes/hostel";
import { LibraryPortalPage } from "@/routes/library";
import { StudentDashboardPage } from "@/routes/student.dashboard";
import { StudentFeesPage } from "@/routes/student.fees";
import { StudentHostelPage } from "@/routes/student.hostel";
import { StudentLibraryPage } from "@/routes/student.library";
import { StudentCertificateFlowPage } from "@/routes/student.certificate-flow";
import { StudentMarksCardPage } from "@/routes/student.marks-card";
import { GradecardQrDownloadPage } from "@/routes/gradecard.download";
import { CoeDegreeCertificatePage } from "@/routes/coe.degree-certificate";
import { CoeDegreeCertificatePreviewPage } from "@/routes/coe.degree-certificate.preview.$studentId";
import { StudentDegreeCertificatePage } from "@/routes/student.degree-certificate";
import { DegreeVerifyPage } from "@/routes/degree.verify";
import { DegreeQrDownloadPage } from "@/routes/degree.download";

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
          {/* Legacy per-portal login URLs (admin_2 → Admin, admin_1 → COE) */}
          <Route path="login/admin_2" element={<Navigate to="/login" replace />} />
          <Route path="login/admin_1" element={<Navigate to="/login" replace />} />
          <Route path="login/faculty" element={<Navigate to="/login" replace />} />
          <Route path="login/admin" element={<Navigate to="/login" replace />} />
          <Route path="login/super-admin" element={<Navigate to="/login" replace />} />
          <Route path="login/super_admin" element={<Navigate to="/login" replace />} />
          <Route path="login/head-of-coe" element={<Navigate to="/login" replace />} />
          <Route path="login/head_of_coe" element={<Navigate to="/login" replace />} />
          <Route path="signup" element={<SignupPage />} />

          {/* New Rebranded Routes */}
          <Route path="coe" element={<CoeOutlet />}>
            <Route index element={<CoePage />} />
            <Route path="credentials" element={<CredentialsPage />} />
            <Route path="marks-configuration" element={<MarksConfigurationPage />} />
            <Route path="grade-card-application" element={<GradeCardApplicationPage />} />
            <Route path="degree-certificate" element={<CoeDegreeCertificatePage />} />
            <Route
              path="degree-certificate/preview/:studentId"
              element={<CoeDegreeCertificatePreviewPage />}
            />
            <Route path="students/:studentId" element={<CoeStudentDetailPage />} />
          </Route>

          <Route path="admin" element={<AdminOutlet />}>
            <Route index element={<AdminPage />} />
            <Route path="students/:studentId" element={<AdminStudentMarksPage />} />
          </Route>

          <Route path="fees" element={<FeesPortalPage />} />
          <Route path="hostel" element={<HostelPortalPage />} />
          <Route path="library" element={<LibraryPortalPage />} />

          {/* Legacy Redirects */}
          <Route path="developer" element={<Navigate to="/coe" replace />} />
          <Route
            path="super-admin/*"
            element={<LegacyPathRedirect fromPrefix="/super-admin" toPrefix="/coe" />}
          />
          <Route
            path="faculty/*"
            element={<LegacyPathRedirect fromPrefix="/faculty" toPrefix="/admin" />}
          />
          <Route path="admin/login" element={<Navigate to="/login" replace />} />
          <Route path="student/login" element={<Navigate to="/login" replace />} />
          <Route
            path="head-of-coe/*"
            element={<LegacyPathRedirect fromPrefix="/head-of-coe" toPrefix="/coe" />}
          />

          {/* Student Portal */}
          <Route path="student/dashboard" element={<StudentDashboardPage />} />
          <Route path="student/fees" element={<StudentFeesPage />} />
          <Route path="student/hostel" element={<StudentHostelPage />} />
          <Route path="student/library" element={<StudentLibraryPage />} />
          <Route path="student/certificate-flow" element={<StudentCertificateFlowPage />} />
          <Route path="student/marks-card" element={<StudentMarksCardPage />} />
          <Route path="student/degree-certificate" element={<StudentDegreeCertificatePage />} />
          <Route path="gradecard/download" element={<GradecardQrDownloadPage />} />
          <Route path="degree/download" element={<DegreeQrDownloadPage />} />
          <Route path="degree/verify" element={<DegreeVerifyPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
