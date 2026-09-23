import { Navigate } from 'react-router-dom'

export default function StaffVerificationPage() {
  return <Navigate to="/staff/donations?status=Pending+Verification" replace />
}
