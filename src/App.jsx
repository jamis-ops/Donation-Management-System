import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PublicLayout from './components/layout/PublicLayout'
import AdminLayout from './components/admin/layout/AdminLayout'
import ProtectedRoute from './components/admin/ProtectedRoute'
import RoleProtectedRoute from './portals/shared/RoleProtectedRoute'
import PortalLayout from './portals/shared/PortalLayout'

// Public pages
import HomePage from './pages/HomePage'
import SuccessStoriesPage from './pages/SuccessStoriesPage'
import VolunteerPage from './pages/VolunteerPage'
import DonatePage from './pages/DonatePage'
import AssistancePage from './pages/AssistancePage'
import ContactPage from './pages/ContactPage'
import FAQPage from './pages/FAQPage'
import UserLoginPage from './pages/LoginPage'

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
import TasksPage from './pages/admin/TasksPage'
import ReportsPage from './pages/admin/ReportsPage'
import CertificatesPage from './pages/admin/CertificatesPage'
import ContentPage from './pages/admin/ContentPage'

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

const router = createBrowserRouter([
  { path: 'login', element: <UserLoginPage /> },
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'stories', element: <SuccessStoriesPage /> },
      { path: 'volunteer', element: <VolunteerPage /> },
      { path: 'donate', element: <DonatePage /> },
      { path: 'assistance', element: <AssistancePage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'faq', element: <FAQPage /> },
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
      { path: 'tasks', element: <TasksPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'certificates', element: <CertificatesPage /> },
      { path: 'content', element: <ContentPage /> },
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
