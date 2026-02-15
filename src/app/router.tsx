import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { DashboardPage } from "../pages/DashboardPage";
import { DocsPage } from "../pages/DocsPage";
import { KBPage } from "../pages/KBPage";
import { LMSPage } from "../pages/LMSPage";
import { LoginPage } from "../pages/LoginPage";
import { NewsPage } from "../pages/NewsPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { OrgPage } from "../pages/OrgPage";
import { RatingsPage } from "../pages/RatingsPage";
import { TasksPage } from "../pages/TasksPage";
import { AdminPage } from "../pages/AdminPage";
import { OpsCenterPage } from "../pages/OpsCenterPage";
import { NotificationsPage } from "../pages/NotificationsPage";
import { ReportsPage } from "../pages/ReportsPage";
import { LMSBuilderPage } from "../pages/LMSBuilderPage";
import { RouteErrorPage } from "../pages/RouteErrorPage";
import { SearchPage } from "../pages/SearchPage";
import { SystemGuidePage } from "../pages/SystemGuidePage";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <RouteErrorPage /> },
  {
    path: "/",
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "news", element: <NewsPage /> },
          { path: "kb", element: <KBPage /> },
          { path: "kb/:articleId", element: <KBPage /> },
          { path: "lms", element: <LMSPage /> },
          { path: "lms/courses/:courseId", element: <LMSPage /> },
          { path: "lms/users/:userId", element: <LMSPage /> },
          { path: "lms-builder", element: <LMSBuilderPage /> },
          { path: "docs", element: <DocsPage /> },
          { path: "tasks", element: <TasksPage /> },
          { path: "tasks/:taskId", element: <TasksPage /> },
          { path: "ops", element: <OpsCenterPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          { path: "search", element: <SearchPage /> },
          { path: "system-guide", element: <SystemGuidePage /> },
          { path: "reports", element: <ReportsPage /> },
          { path: "org", element: <OrgPage /> },
          { path: "ratings", element: <RatingsPage /> },
          { path: "admin", element: <AdminPage /> },
          { path: "404", element: <NotFoundPage /> },
          { path: "*", element: <Navigate to="/404" replace /> },
        ],
      },
    ],
  },
]);
