import { createBrowserRouter, RouterProvider, Navigate, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import PublicLayout from './components/layout/PublicLayout'
import AdminLayout from './components/admin/layout/AdminLayout'
import ProtectedRoute from './components/admin/ProtectedRoute'
import RoleProtectedRoute from './portals/shared/RoleProtectedRoute'
import PortalLayout from './portals/shared/PortalLayout'

// Public pages
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import SuccessStoriesPage from './pages/SuccessStoriesPage'
import VolunteerPage from './pages/VolunteerPage'
import DonatePage from './pages/DonatePage'
import AssistancePage from './pages/AssistancePage'
import ContactPage from './pages/ContactPage'
import FAQPage from './pages/FAQPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsPage from './pages/TermsPage'
import UserLoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import VerifiedPage from './pages/VerifiedPage'

// Admin pages
import AdminLoginPage from './pages/admin/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import DonationsPage from './pages/admin/DonationsPage'
import DonorsPage from './pages/admin/DonorsPage'
import BeneficiariesPage from './pages/admin/BeneficiariesPage'
import InventoryPage from './pages/admin/InventoryPage'
import AllocationPage from './pages/admin/AllocationPage'
import DistributionsPage from './pages/admin/DistributionsPage'
import VolunteersPage from './pages/admin/VolunteersPage'
import StaffPage from './pages/admin/StaffPage'
import ReportsPage from './pages/admin/ReportsPage'
import CertificatesPage from './pages/admin/CertificatesPage'
import ContentPage from './pages/admin/ContentPage'
import AccountSettingsPage from './pages/AccountSettingsPage'

// Role portals
import DonorDashboard from './portals/donor/DonorDashboard'
import DonorDonationsPage from './portals/donor/DonorDonationsPage'
import DonorCertificatesPage from './portals/donor/DonorCertificatesPage'
import VolunteerDashboard from './portals/volunteer/VolunteerDashboard'
import VolunteerTasksPage from './portals/volunteer/VolunteerTasksPage'
import VolunteerSchedulePage from './portals/volunteer/VolunteerSchedulePage'
import VolunteerHoursPage from './portals/volunteer/VolunteerHoursPage'
import VolunteerCertificatesPage from './portals/volunteer/VolunteerCertificatesPage'
import BeneficiaryDashboard from './portals/beneficiary/BeneficiaryDashboard'
import BeneficiaryRequestsPage from './portals/beneficiary/BeneficiaryRequestsPage'
import BeneficiaryDistributionsPage from './portals/beneficiary/BeneficiaryDistributionsPage'
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
  { path: 'register', element: <RegisterPage /> },
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
  { path: 'admin/login', element: <AdminLoginPage /> },
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
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'allocation', element: <AllocationPage /> },
      { path: 'distributions', element: <DistributionsPage /> },
      { path: 'volunteers', element: <VolunteersPage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'tasks', element: <Navigate to="/admin/volunteers" replace /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'certificates', element: <CertificatesPage /> },
      { path: 'content', element: <ContentPage /> },
      { path: 'settings', element: <AccountSettingsPage /> },
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
      { path: 'distributions', element: <BeneficiaryDistributionsPage /> },
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
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
