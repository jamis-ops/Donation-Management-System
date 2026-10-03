import { createBrowserRouter, RouterProvider, Navigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { LoadingProvider } from './context/LoadingContext'
import PublicLayout from './public/components/layout/PublicLayout'
import AdminLayout from './admin/components/layout/AdminLayout'
import ProtectedRoute from './admin/components/ProtectedRoute'
import RoleProtectedRoute from './portals/shared/RoleProtectedRoute'
import PortalLayout from './portals/shared/PortalLayout'

// Public pages
import HomePage from './public/pages/HomePage'
import AboutPage from './public/pages/AboutPage'
import ProjectDetailPage from './public/pages/ProjectDetailPage'
import SuccessStoriesPage from './public/pages/SuccessStoriesPage'
import VolunteerPage from './public/pages/VolunteerPage'
import DonatePage from './public/pages/DonatePage'
import AssistancePage from './public/pages/AssistancePage'
import ContactPage from './public/pages/ContactPage'
import FAQPage from './public/pages/FAQPage'
import PrivacyPolicyPage from './public/pages/PrivacyPolicyPage'
import TermsPage from './public/pages/TermsPage'

// Auth pages
import UserLoginPage from './auth/pages/LoginPage'
import ForgotPasswordPage from './auth/pages/ForgotPasswordPage'
import ChangePasswordPage from './auth/pages/ChangePasswordPage'
import VerifiedPage from './auth/pages/VerifiedPage'
import AcceptInvitePage from './auth/pages/AcceptInvitePage'

// Admin pages
import AdminLoginPage from './admin/pages/LoginPage'
import DashboardPage from './admin/pages/DashboardPage'
import DonationsPage from './admin/pages/DonationsPage'
import DonorsPage from './admin/pages/DonorsPage'
import BeneficiariesPage from './admin/pages/BeneficiariesPage'
import BarangayDetailsPage from './admin/pages/BarangayDetailsPage'
import RequestsPage from './admin/pages/RequestsPage'
import InventoryPage from './admin/pages/InventoryPage'
import AllocationPage from './admin/pages/AllocationPage'
import DistributionsPage from './admin/pages/DistributionsPage'
import VolunteersPage from './admin/pages/VolunteersPage'
import StaffPage from './admin/pages/StaffPage'
import AdminsPage from './admin/pages/AdminsPage'
import ReportsPage from './admin/pages/ReportsPage'
import CertificatesPage from './admin/pages/CertificatesPage'
import ContentPage from './admin/pages/ContentPage'
import AccountSettingsPage from './public/pages/AccountSettingsPage'
import DatabaseManagementPage from './admin/pages/DatabaseManagementPage'

// Role portals
import DonorDashboard from './portals/donor/DonorDashboard'
import DonorDonationsPage from './portals/donor/DonorDonationsPage'
import DonorImpactPage from './portals/donor/DonorImpactPage'
import DonorCertificatesPage from './portals/donor/DonorCertificatesPage'
import VolunteerDashboard from './portals/volunteer/VolunteerDashboard'
import VolunteerTasksPage from './portals/volunteer/VolunteerTasksPage'
import VolunteerDistributionsPage from './portals/volunteer/VolunteerDistributionsPage'
import VolunteerSchedulePage from './portals/volunteer/VolunteerSchedulePage'
import VolunteerHoursPage from './portals/volunteer/VolunteerHoursPage'
import VolunteerCertificatesPage from './portals/volunteer/VolunteerCertificatesPage'
import BeneficiaryDashboard from './portals/beneficiary/BeneficiaryDashboard'
import BeneficiaryRequestsPage from './portals/beneficiary/BeneficiaryRequestsPage'
import BeneficiaryHistoryPage from './portals/beneficiary/BeneficiaryHistoryPage'
import BeneficiaryProofsPage from './portals/beneficiary/BeneficiaryProofsPage'
import StaffDashboard from './portals/staff/StaffDashboard'
import StaffDonationsPage from './portals/staff/StaffDonationsPage'
import StaffInventoryPage from './portals/staff/StaffInventoryPage'
import StaffDistributionsPage from './portals/staff/StaffDistributionsPage'
import StaffTasksPage from './portals/staff/StaffTasksPage'

/** Old email links used /verify?token=… — silently hand off to the API (no UI). */
function LegacyVerifyRedirect() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  useEffect(() => {
    if (!token) {
      window.location.replace('/login')
      return
    }
    window.location.replace(`/api/verify.php?token=${encodeURIComponent(token)}`)
  }, [token])
  return null
}

const router = createBrowserRouter([
  { path: 'login', element: <UserLoginPage /> },
  { path: 'forgot-password', element: <ForgotPasswordPage /> },
  { path: 'register', element: <Navigate to="/contact" replace /> },
  { path: 'accept-invite/:token', element: <AcceptInvitePage /> },
  { path: 'change-password', element: <ChangePasswordPage /> },
  { path: 'verified', element: <VerifiedPage /> },
  {
    // Legacy email links that pointed at /verify?token=… — forward to the API verifier.
    path: 'verify',
    element: <LegacyVerifyRedirect />,
  },
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'projects/:projectId', element: <ProjectDetailPage /> },
      { path: 'stories', element: <SuccessStoriesPage /> },
      { path: 'volunteer', element: <VolunteerPage /> },
      { path: 'donate', element: <DonatePage /> },
      { path: 'assistance', element: <AssistancePage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'faq', element: <FAQPage /> },
      { path: 'privacy', element: <PrivacyPolicyPage /> },
      { path: 'terms', element: <TermsPage /> },
    ],
  },
  { path: 'admin/login', element: <Navigate to="/login" replace /> },
  {
    path: 'admin',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'donations', element: <DonationsPage /> },
      { path: 'donors', element: <DonorsPage /> },
      { path: 'beneficiaries', element: <BeneficiariesPage /> },
      { path: 'beneficiaries/:id', element: <BarangayDetailsPage /> },
      { path: 'barangays/:id', element: <BarangayDetailsPage /> },
      { path: 'requests', element: <RequestsPage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'allocation', element: <AllocationPage /> },
      { path: 'distributions', element: <DistributionsPage /> },
      { path: 'volunteers', element: <VolunteersPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'admins', element: <AdminsPage /> },
      { path: 'tasks', element: <Navigate to="/admin/volunteers" replace /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'certificates', element: <CertificatesPage /> },
      { path: 'content', element: <ContentPage /> },
      { path: 'settings', element: <AccountSettingsPage /> },
      { path: 'database', element: <DatabaseManagementPage /> },
    ],
  },
  {
    path: 'donor',
    element: (
      <RoleProtectedRoute allowedRoles={['Donor']}>
        <PortalLayout role="Donor" />
      </RoleProtectedRoute>
    ),
    children: [
      { index: true, element: <DonorDashboard /> },
      { path: 'donations', element: <DonorDonationsPage /> },
      { path: 'impact', element: <DonorImpactPage /> },
      { path: 'certificates', element: <DonorCertificatesPage /> },
      { path: 'settings', element: <AccountSettingsPage /> },
    ],
  },
  {
    path: 'volunteer-portal',
    element: (
      <RoleProtectedRoute allowedRoles={['Volunteer']}>
        <PortalLayout role="Volunteer" />
      </RoleProtectedRoute>
    ),
    children: [
      { index: true, element: <VolunteerDashboard /> },
      { path: 'tasks', element: <VolunteerTasksPage /> },
      { path: 'distributions', element: <VolunteerDistributionsPage /> },
      { path: 'schedule', element: <VolunteerSchedulePage /> },
      { path: 'hours', element: <Navigate to="/volunteer-portal/tasks" replace /> },
      { path: 'certificates', element: <VolunteerCertificatesPage /> },
      { path: 'settings', element: <AccountSettingsPage /> },
    ],
  },
  {
    path: 'intern-portal',
    element: (
      <RoleProtectedRoute allowedRoles={['Intern']}>
        <PortalLayout role="Intern" />
      </RoleProtectedRoute>
    ),
    children: [
      { index: true, element: <VolunteerDashboard /> },
      { path: 'tasks', element: <VolunteerTasksPage /> },
      { path: 'distributions', element: <VolunteerDistributionsPage /> },
      { path: 'schedule', element: <VolunteerSchedulePage /> },
      { path: 'hours', element: <VolunteerHoursPage /> },
      { path: 'certificates', element: <VolunteerCertificatesPage /> },
      { path: 'settings', element: <AccountSettingsPage /> },
    ],
  },
  {
    path: 'beneficiary',
    element: (
      <RoleProtectedRoute allowedRoles={['Beneficiary']}>
        <PortalLayout role="Beneficiary" />
      </RoleProtectedRoute>
    ),
    children: [
      { index: true, element: <BeneficiaryDashboard /> },
      { path: 'requests', element: <BeneficiaryRequestsPage /> },
      { path: 'distributions', element: <Navigate to="/beneficiary/requests" replace /> },
      { path: 'proofs', element: <BeneficiaryProofsPage /> },
      { path: 'history', element: <BeneficiaryHistoryPage /> },
      { path: 'settings', element: <AccountSettingsPage /> },
    ],
  },
  {
    path: 'staff',
    element: (
      <RoleProtectedRoute allowedRoles={['Staff']}>
        <PortalLayout role="Staff" />
      </RoleProtectedRoute>
    ),
    children: [
      { index: true, element: <StaffDashboard /> },
      { path: 'donations', element: <StaffDonationsPage /> },
      { path: 'verification', element: <Navigate to="/staff/donations?status=Pending+Verification" replace /> },
      { path: 'inventory', element: <StaffInventoryPage /> },
      { path: 'distributions', element: <StaffDistributionsPage /> },
      { path: 'tasks', element: <StaffTasksPage /> },
      { path: 'settings', element: <AccountSettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <LoadingProvider>
          <RouterProvider router={router} />
        </LoadingProvider>
      </ConfirmProvider>
    </AuthProvider>
  )
}
