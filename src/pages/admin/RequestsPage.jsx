import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { assistanceRequestsApi, beneficiariesApi } from '../../api/resources';
import { useApiList } from '../../hooks/useApiList';
import { useFilters } from '../../hooks/useFilters';
import { 
  AlertTriangle, AlertCircle, Clock, CheckCircle, 
  Users, Search, Pin, FileText, 
  Check, X, MapPin, Loader2, Info,
  Utensils, Droplets, Shirt, Pill, Sparkles, Home, Banknote, GraduationCap, Package, Tag
} from 'lucide-react';
import PageHeader from '../../components/admin/shared/PageHeader';
import ModalHeader from '../../components/admin/shared/ModalHeader';
import StatusBadge from '../../components/admin/shared/StatusBadge';
import FilterBar from '../../components/admin/shared/FilterBar';
import ApiState from '../../components/admin/shared/ApiState';
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../../components/admin/shared/Pagination'
import { notify } from '../../utils/toast';
import { confirmAction, showSuccessModal } from '../../utils/confirm';
import { notifyBadgesChanged } from '../../utils/badgeSync';
import {
  REQUEST_WORKFLOW,
  REQUEST_TERMINAL,
  REQUEST_BRANCHES,
  REQUEST_ALIASES,
  validateStatusTransition,
  isTerminalStatus,
} from '../../utils/workflow';
import { useLoading } from '../../context/LoadingContext';

const styles = `
.requests-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-family: var(--font-sans);
}
.requests-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}
.requests-page .stat-card {
  background: var(--admin-surface, #ffffff);
  border-radius: var(--admin-radius-lg, 14px);
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--admin-border, #e2e8f0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 115px;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}
.requests-page .stat-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 22px rgba(175, 16, 26, 0.12);
  border-color: #fca5a5;
}
.requests-page .stat-card--active {
  border-color: #AF101A !important;
  box-shadow: 0 0 0 2px rgba(175, 16, 26, 0.16), 0 4px 14px rgba(175, 16, 26, 0.1) !important;
  background-color: #fff9f9 !important;
}
.requests-page .stat-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.requests-page .stat-card__label {
  font-family: var(--font-sans);
  font-size: 0.84rem;
  font-weight: 600;
  color: #475569;
  margin: 0;
  letter-spacing: 0.01em;
}
.requests-page .stat-card__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}
.requests-page .stat-card:hover .stat-card__icon {
  transform: scale(1.08);
}
.requests-page .stat-card__icon--neutral { background: rgba(175, 16, 26, 0.08); color: #AF101A; }
.requests-page .stat-card__icon--warning { background: rgba(245, 158, 11, 0.12); color: #d97706; }
.requests-page .stat-card__icon--success { background: rgba(22, 163, 74, 0.12); color: #16a34a; }
.requests-page .stat-card__icon--danger { background: rgba(220, 38, 38, 0.12); color: #dc2626; }
.requests-page .stat-card__icon--muted { background: #f1f5f9; color: #94a3b8; }

.requests-page .stat-card .value {
  font-family: var(--font-sans);
  font-size: 2.15rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0.75rem 0 0 0;
  line-height: 1;
}

.requests-page .stat-card.critical-alert-active {
  border-color: #fca5a5;
  background-color: #fff5f5;
}
.requests-page .stat-card.critical-alert-active .value {
  color: #dc2626;
}

@keyframes pulse-red {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

.requests-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  align-items: stretch;
}
@media (min-width: 768px) {
  .requests-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1200px) {
  .requests-grid { grid-template-columns: repeat(3, 1fr); }
}

.request-card {
  background: var(--admin-surface);
  border-radius: var(--admin-radius-lg);
  border: 1px solid var(--admin-border);
  box-shadow: var(--admin-shadow);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  height: 100%;
  min-height: 100%;
  box-sizing: border-box;
  transition: transform 0.2s, box-shadow 0.2s;
  font-family: var(--font-sans);
}
.request-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--admin-shadow-md);
}
.request-card.priority-critical { border-left: 4px solid #dc2626; }
.request-card.priority-high { border-left: 4px solid #ea580c; }
.request-card.priority-medium { border-left: 4px solid #d97706; }
.request-card.priority-low { border-left: 4px solid #16a34a; }

.request-card.is-emergency {
  border: 2px solid #ef4444;
  animation: border-pulse 2s infinite;
}
@keyframes border-pulse {
  0%, 100% { border-color: #ef4444; box-shadow: 0 0 0 rgba(239, 68, 68, 0.15); }
  50% { border-color: #f87171; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12); }
}
.emergency-label {
  background: var(--admin-brand);
  color: white;
  font-size: 0.7rem;
  font-weight: bold;
  text-align: center;
  padding: 2px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: var(--font-sans);
}

.request-card__body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
}

.request-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}
.request-card__title {
  font-family: var(--font-sans);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--admin-text);
  margin: 0 0 0.25rem 0;
  line-height: 1.25;
}
.request-card__ref {
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  color: var(--admin-text-muted);
  background: var(--admin-bg);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
.request-card__badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  font-family: var(--font-sans);
}
.priority-badge.critical { background: #fee2e2; color: #dc2626; }
.priority-badge.high { background: #fff7ed; color: #ea580c; }
.priority-badge.medium { background: #fefce8; color: #d97706; }
.priority-badge.low { background: #f0fdf4; color: #16a34a; }

.request-card__desc {
  font-size: 0.875rem;
  color: var(--admin-text-muted);
  margin: 0;
  line-height: 1.45;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}
.request-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--admin-text-muted);
}
.request-card__meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.request-card__sla {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.375rem 0.5rem;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-family: var(--font-sans);
}
.sla-green { background: rgba(22, 163, 74, 0.1); color: #15803d; }
.sla-yellow { background: rgba(217, 119, 6, 0.1); color: #b45309; }
.sla-red { background: rgba(220, 38, 38, 0.1); color: #b91c1c; }

.request-card__actions {
  border-top: 1px solid var(--admin-border);
  padding: 0.75rem 1.25rem;
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  margin-top: auto;
  background: var(--admin-bg);
}

.btn-icon {
  background: transparent;
  border: none;
  color: var(--admin-text-muted);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.btn-icon:hover {
  background: var(--admin-brand-muted);
  color: var(--admin-brand);
}
.btn-icon.active {
  color: var(--admin-danger);
}

.requests-page .btn--outline {
  background: transparent;
  border-color: var(--admin-border);
  color: var(--admin-text);
}
.requests-page .btn--outline:hover {
  background: var(--admin-brand-muted);
  border-color: rgba(175, 16, 26, 0.25);
  color: var(--admin-brand);
}

.requests-page .admin-modal__right {
  flex: 2;
  background: var(--admin-bg);
  border-radius: var(--admin-radius);
  padding: 1.25rem;
  border: 1px solid var(--admin-border);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-group label {
  font-size: 0.875rem;
  color: var(--admin-text-muted);
  font-weight: 500;
  font-family: var(--font-sans);
}
.form-group input, .form-group select, .form-group textarea {
  background: var(--admin-surface);
  border: 1px solid var(--admin-border);
  color: var(--admin-text);
  padding: 0.75rem;
  border-radius: 6px;
  font-family: var(--font-sans);
}
.form-group textarea { min-height: 100px; resize: vertical; }
.form-group select:focus, .form-group input:focus, .form-group textarea:focus {
  outline: none;
  border-color: var(--admin-brand);
}

.admin-modal__footer {
  padding: 1.5rem;
  border-top: 1px solid var(--admin-border);
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  background: var(--admin-bg);
}

.barangay-context-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.barangay-context-card h3 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.05rem;
  font-family: var(--font-sans);
  color: var(--admin-text);
}
.barangay-stat {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--admin-text-muted);
}
.barangay-stat strong { color: var(--admin-text); }

.admin-modal__body {
  display: flex;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  overflow: auto;
}

.admin-modal__left {
  flex: 3;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

/* ---------- Modern Relief Request Review Modal ---------- */
.relief-review-modal {
  max-width: 820px !important;
  width: 95vw !important;
  padding: 0 !important;
  border-radius: 12px !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-sizing: border-box !important;
}

.relief-review-modal .admin-modal__header {
  margin: 0 !important;
  top: 0 !important;
  position: static !important;
  padding: 1rem 1.25rem !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  background: linear-gradient(135deg, #AF101A 0%, #8E0D15 100%) !important;
  border-top-left-radius: 12px !important;
  border-top-right-radius: 12px !important;
  box-shadow: none !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
}

.relief-review-modal .admin-modal__header h2 {
  font-size: 1.15rem !important;
  font-weight: 700 !important;
  color: #ffffff !important;
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.3 !important;
}

.relief-review-modal .admin-modal__close {
  margin: 0 !important;
  width: 32px !important;
  height: 32px !important;
}

.relief-review-header-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.relief-review-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.relief-priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
  line-height: 1.2;
}
.relief-priority-badge--critical {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.relief-priority-badge--high {
  background: #fff7ed;
  color: #ea580c;
  border: 1px solid #fed7aa;
}
.relief-priority-badge--medium {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}
.relief-priority-badge--low {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

.relief-meta-strip {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-size: 0.8125rem;
  color: #64748b;
  flex-wrap: wrap;
}

.relief-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.relief-sla-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}
.relief-sla-tag--red {
  background: #fee2e2;
  color: #b91c1c;
}
.relief-sla-tag--yellow {
  background: #fef3c7;
  color: #b45309;
}
.relief-sla-tag--green {
  background: #dcfce7;
  color: #15803d;
}

.relief-review-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 1.15rem;
  padding: 1.1rem 1.25rem;
  background: #ffffff;
  box-sizing: border-box;
}

.relief-review-col {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}

.relief-review-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.relief-section-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.relief-section-label span.editable-hint {
  font-size: 0.7rem;
  font-weight: normal;
  text-transform: none;
  color: #94a3b8;
}

.relief-needs-box {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0.5rem 0.65rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  min-height: 38px;
  align-items: center;
}

.relief-need-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #ffffff;
  color: #991b1b;
  border: 1px solid #fecaca;
  padding: 0.22rem 0.55rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}

.relief-notes-textarea {
  width: 100%;
  height: 80px;
  min-height: 70px;
  max-height: 95px;
  padding: 0.55rem 0.7rem;
  font-size: 0.8125rem;
  line-height: 1.4;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  resize: vertical;
  background: #ffffff;
  color: #1e293b;
  font-family: var(--font-sans);
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.relief-notes-textarea:focus {
  outline: none;
  border-color: var(--admin-brand);
  box-shadow: 0 0 0 3px rgba(175, 16, 26, 0.1);
}

.relief-barangay-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.75rem;
  height: 100%;
  box-sizing: border-box;
}

.relief-barangay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.5rem;
}

.relief-barangay-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.relief-barangay-muni {
  font-size: 0.72rem;
  font-weight: 600;
  color: #475569;
  background: #e2e8f0;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.relief-barangay-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem 0.75rem;
}

.relief-bstat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.relief-bstat-label {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.relief-bstat-val {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.relief-view-barangay-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 6px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
}
.relief-view-barangay-btn:hover {
  border-color: var(--admin-brand);
  color: var(--admin-brand);
  background: #fff9f9;
}

.relief-duplicate-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 0.45rem 0.75rem;
  color: #b45309;
  font-size: 0.78rem;
}

.relief-review-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  gap: 0.75rem;
}

.relief-review-footer-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

@media (max-width: 680px) {
  .relief-review-grid {
    grid-template-columns: 1fr;
    padding: 0.85rem;
  }
  .relief-review-modal {
    max-height: 94vh !important;
    overflow-y: auto !important;
  }
}
`;

const priorityConfig = {
  Critical: { color: 'critical', icon: AlertTriangle, label: 'CRITICAL', slaHours: 4, weight: 4 },
  High: { color: 'high', icon: AlertCircle, label: 'HIGH', slaHours: 24, weight: 3 },
  Medium: { color: 'medium', icon: Clock, label: 'MEDIUM', slaHours: 72, weight: 2 },
  Low: { color: 'low', icon: CheckCircle, label: 'LOW', slaHours: 168, weight: 1 }
};

function getSLALabel(req) {
  const pConf = priorityConfig[req.priority] || priorityConfig.Medium;
  const created = new Date(req.requestDate || req.date || Date.now());
  const now = new Date();
  const elapsedHours = (now - created) / (1000 * 60 * 60);
  const remainingHours = pConf.slaHours - elapsedHours;
  const percentUsed = (elapsedHours / pConf.slaHours) * 100;

  if (remainingHours < 0) {
    const overdueHrs = Math.floor(Math.abs(remainingHours));
    const overdueMins = Math.floor((Math.abs(remainingHours) * 60) % 60);
    return { status: 'red', text: `⚠️ OVERDUE by ${overdueHrs}h ${overdueMins}m` };
  }
  if (percentUsed >= 50) {
    return { status: 'yellow', text: `Response in ${Math.floor(remainingHours)}h` };
  }
  return { status: 'green', text: `Response in ${Math.floor(remainingHours)}h` };
}

function timeAgo(dateString) {
  if (!dateString) return 'Just now';
  const diffMins = Math.floor((new Date() - new Date(dateString)) / 60000);
  if (diffMins < 60) return `${Math.max(0, diffMins)} min${diffMins !== 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

const NEED_ICONS = {
  Food: Utensils,
  Water: Droplets,
  Clothing: Shirt,
  Medicine: Pill,
  'Hygiene Kits': Sparkles,
  Shelter: Home,
  'Financial Assistance': Banknote,
  'Educational Support': GraduationCap,
};

function iconForNeed(label) {
  if (NEED_ICONS[label]) return NEED_ICONS[label];
  const key = String(label || '').toLowerCase();
  if (key.includes('food') || key.includes('rice')) return Utensils;
  if (key.includes('water')) return Droplets;
  if (key.includes('cloth')) return Shirt;
  if (key.includes('medicine') || key.includes('medical')) return Pill;
  if (key.includes('hygiene')) return Sparkles;
  if (key.includes('shelter') || key.includes('housing')) return Home;
  if (key.includes('financial') || key.includes('cash')) return Banknote;
  if (key.includes('educat') || key.includes('school')) return GraduationCap;
  if (key.includes('relief') || key.includes('pack')) return Package;
  return Tag;
}

export default function RequestsPage() {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const { data: requestsData, loading: reqLoading, error: reqError, reload: reqReload } = useApiList(() => assistanceRequestsApi.list());
  const { data: beneficiariesData } = useApiList(() => beneficiariesApi.list());
  
  const [emergencyIds, setEmergencyIds] = useState(() => new Set());
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = styles;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  // Allocated / Completed requests have left the relief queue — they continue in Allocation / Distribution.
  const DONE_RELIEF_STATUSES = ['Allocated', 'Completed']

  const enrichedData = useMemo(() => {
    if (!requestsData || !beneficiariesData) return requestsData || [];
    const bMap = new Map(beneficiariesData.map(b => [b.dbId, b]));
    return requestsData.map(req => {
      const b = bMap.get(req.beneficiaryId);
      return {
        ...req,
        affectedFamilies: b?.affectedFamilies || b?.population || 0,
        municipality: b?.municipality || 'Cebu',
        representative: b?.representative || 'Unknown'
      };
    });
  }, [requestsData, beneficiariesData]);

  const activeReliefData = useMemo(
    () => enrichedData.filter((r) => !DONE_RELIEF_STATUSES.includes(r.status)),
    [enrichedData],
  );

  const filterConfig = useMemo(() => ({
    searchKeys: ['beneficiary', 'id', 'type', 'notes'],
    filters: [
      { key: 'priority', label: 'Priority', options: ['Critical', 'High', 'Medium', 'Low'] },
      { key: 'status', label: 'Status', options: ['Pending Review', 'Under Review', 'Approved', 'Rejected'] }
    ]
  }), []);

  const filterController = useFilters(activeReliefData, filterConfig);

  const sortedData = useMemo(() => {
    const arr = [...filterController.filtered];
    return arr.sort((a, b) => {
      const aEm = emergencyIds.has(a.dbId);
      const bEm = emergencyIds.has(b.dbId);
      if (aEm && !bEm) return -1;
      if (!aEm && bEm) return 1;

      const pA = priorityConfig[a.priority]?.weight || 0;
      const pB = priorityConfig[b.priority]?.weight || 0;
      if (pA !== pB) return pB - pA;
      return (new Date(b.createdAt || b.date || b.requestDate || 0) - new Date(a.createdAt || a.date || a.requestDate || 0)) || (b.dbId - a.dbId);
    });
  }, [filterController.filtered, emergencyIds]);

  const paging = usePagination(
    sortedData,
    DEFAULT_PAGE_SIZE,
    `${filterController.search}|${filterController.values?.priority || ''}|${filterController.values?.status || ''}`,
  );

  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let critical = 0;
    activeReliefData.forEach(r => {
      if (r.status === 'Pending Review' || r.status === 'Under Review') pending++;
      if (r.status === 'Approved') approved++;
      if (r.priority === 'Critical' && r.status !== 'Rejected') critical++;
    });
    return { total: activeReliefData.length, pending, approved, critical };
  }, [activeReliefData]);

  const toggleEmergency = (dbId, e) => {
    e.stopPropagation();
    setEmergencyIds(prev => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId);
      else next.add(dbId);
      return next;
    });
  };

  const handleUpdateStatus = async (dbId, updates) => {
    const existing = (enrichedData || []).find((r) => r.dbId === dbId);
    if (updates?.status) {
      if (existing) {
        const check = validateStatusTransition({
          entityName: 'Assistance request',
          currentStatus: existing.status,
          nextStatus: updates.status,
          workflowOrder: REQUEST_WORKFLOW,
          terminalStatuses: REQUEST_TERMINAL,
          branches: REQUEST_BRANCHES,
          aliases: REQUEST_ALIASES,
        });
        if (!check.valid) {
          notify.error(check.message);
          return;
        }
      }

      if (updates.status === 'Approved') {
        const ok = await confirmAction({
          title: 'Approve Relief Request',
          message: `Approve relief request from ${existing?.beneficiary || 'barangay'} for ${existing?.type || 'relief assistance'} (${existing?.affectedFamilies || 0} families)?`,
          confirmText: 'Approve Request',
          type: 'primary',
        });
        if (!ok) return;
      } else if (updates.status === 'Rejected') {
        const ok = await confirmAction({
          title: 'Reject Relief Request',
          message: `Reject relief request from ${existing?.beneficiary || 'barangay'}? This action is final.`,
          confirmText: 'Reject Request',
          type: 'danger',
        });
        if (!ok) return;
      }
    }
    try {
      setIsUpdating(true);
      showLoading('Updating…');
      const res = await assistanceRequestsApi.update(dbId, updates);
      const status = res?.data?.status || updates.status || 'Updated'
      await reqReload();
      notifyBadgesChanged();
      notify.success(`Status successfully updated to: ${status}.`);
      if (updates?.status === 'Approved') {
        showSuccessModal('Successfully approved.')
      } else if (updates?.status === 'Rejected') {
        showSuccessModal('Successfully rejected.')
      } else {
        showSuccessModal('Successfully updated.')
      }
      if (selectedRequest && selectedRequest.dbId === dbId) {
        setSelectedRequest(prev => ({ ...prev, ...updates }));
      }
    } catch (err) {
      notify.error(err?.message || 'Failed to update request');
    } finally {
      hideLoading();
      setIsUpdating(false);
    }
  };

  return (
    <div className="requests-page">
      <PageHeader
        title="Relief Requests"
        description="Manage and review incoming relief requests from partner barangays."
      />

      <ApiState loading={reqLoading} error={reqError} onRetry={reqReload}>
        <div className="requests-stats">
          <div
            className={`stat-card stat-card--clickable ${filterController.values.status === 'all' && filterController.values.priority === 'all' ? 'stat-card--active' : ''}`}
            onClick={() => {
              filterController.setValue('status', 'all')
              filterController.setValue('priority', 'all')
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                filterController.setValue('status', 'all')
                filterController.setValue('priority', 'all')
              }
            }}
            title="View all requests"
          >
            <div className="stat-card__top">
              <span className="stat-card__label">Total Requests</span>
              <div className="stat-card__icon stat-card__icon--neutral">
                <FileText size={18} />
              </div>
            </div>
            <p className="value">{stats.total}</p>
          </div>

          <div
            className={`stat-card stat-card--clickable ${filterController.values.status === 'Pending Review' ? 'stat-card--active' : ''}`}
            onClick={() => {
              filterController.setValue('status', filterController.values.status === 'Pending Review' ? 'all' : 'Pending Review')
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                filterController.setValue('status', filterController.values.status === 'Pending Review' ? 'all' : 'Pending Review')
              }
            }}
            title="Filter by Pending Review requests"
          >
            <div className="stat-card__top">
              <span className="stat-card__label">Pending Review</span>
              <div className="stat-card__icon stat-card__icon--warning">
                <Clock size={18} />
              </div>
            </div>
            <p className="value">{stats.pending}</p>
          </div>

          <div
            className={`stat-card stat-card--clickable ${filterController.values.status === 'Approved' ? 'stat-card--active' : ''}`}
            onClick={() => {
              filterController.setValue('status', filterController.values.status === 'Approved' ? 'all' : 'Approved')
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                filterController.setValue('status', filterController.values.status === 'Approved' ? 'all' : 'Approved')
              }
            }}
            title="Filter by Approved requests"
          >
            <div className="stat-card__top">
              <span className="stat-card__label">Approved</span>
              <div className="stat-card__icon stat-card__icon--success">
                <CheckCircle size={18} />
              </div>
            </div>
            <p className="value">{stats.approved}</p>
          </div>

          <div
            className={`stat-card stat-card--clickable ${stats.critical > 0 ? 'critical-alert-active' : ''} ${filterController.values.priority === 'Critical' ? 'stat-card--active' : ''}`}
            onClick={() => {
              filterController.setValue('priority', filterController.values.priority === 'Critical' ? 'all' : 'Critical')
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                filterController.setValue('priority', filterController.values.priority === 'Critical' ? 'all' : 'Critical')
              }
            }}
            title="Filter by Critical priority requests"
          >
            <div className="stat-card__top">
              <span className="stat-card__label">Critical Alerts</span>
              <div className={`stat-card__icon ${stats.critical > 0 ? 'stat-card__icon--danger' : 'stat-card__icon--muted'}`}>
                <AlertTriangle size={18} />
              </div>
            </div>
            <p className="value">{stats.critical}</p>
          </div>
        </div>

        <FilterBar controller={filterController} searchPlaceholder="Search barangay, type, notes..." />

        <div className="requests-grid">
          {paging.pageItems.map(req => {
            const pConf = priorityConfig[req.priority] || priorityConfig.Medium;
            const PIcon = pConf.icon;
            const isEmergency = emergencyIds.has(req.dbId);
            const sla = getSLALabel(req);

            return (
              <div key={req.dbId} className={`request-card priority-${pConf.color} ${isEmergency ? 'is-emergency' : ''}`}>
                {isEmergency && <div className="emergency-label">EMERGENCY PINNED</div>}
                
                <div className="request-card__body">
                  <div className="request-card__header">
                    <div>
                      <h3 className="request-card__title">{req.beneficiary} <span style={{fontSize: '0.875rem', color: '#94a3b8', fontWeight: 'normal'}}>| {req.municipality}</span></h3>
                      <div className="request-card__badges">
                        <span className={`priority-badge ${pConf.color}`}>
                          <PIcon size={12} /> {pConf.label}
                        </span>
                        <StatusBadge status={req.status} />
                      </div>
                    </div>
                    <span className="request-card__ref">{req.id}</span>
                  </div>

                  <p className="request-card__desc"><strong>{req.type}</strong> - {req.notes}</p>
                  
                  <div className="request-card__meta">
                    <div className="request-card__meta-item">
                      <Users size={14} /> {req.affectedFamilies} families
                    </div>
                    <div className="request-card__meta-item">
                      <Clock size={14} /> {timeAgo(req.requestDate || req.date)}
                    </div>
                  </div>

                  {!['Completed', 'Rejected', 'Allocated'].includes(req.status) && (
                    <div style={{marginTop: 'auto'}}>
                      <span className={`request-card__sla sla-${sla.status}`}>
                        {sla.status === 'red' ? <AlertTriangle size={12} /> : <Info size={12} />}
                        {sla.text}
                      </span>
                    </div>
                  )}
                </div>

                <div className="request-card__actions">
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className={`btn-icon ${isEmergency ? 'active' : ''}`} onClick={(e) => toggleEmergency(req.dbId, e)} title="Pin as Emergency">
                      <Pin size={16} />
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {req.status === 'Approved' ? (
                      <button className="btn btn--sm btn--primary" onClick={() => navigate('/admin/allocation', { state: { prefillRequest: { requestId: req.dbId, beneficiaryId: req.beneficiaryId, type: req.type, notes: req.notes, beneficiaryName: req.beneficiary } } })}>
                        Create Allocation &rarr;
                      </button>
                    ) : (
                      <>
                        <button className="btn btn--sm btn--outline" onClick={() => setSelectedRequest(req)}>Review</button>
                        {req.status !== 'Rejected' && (
                          <button className="btn btn--sm btn--success" onClick={() => handleUpdateStatus(req.dbId, { status: 'Approved' })}><Check size={14}/></button>
                        )}
                        {req.status !== 'Rejected' && (
                          <button className="btn btn--sm btn--danger" onClick={() => handleUpdateStatus(req.dbId, { status: 'Rejected' })}><X size={14}/></button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {sortedData.length === 0 && (
            <div className="admin-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--admin-text-muted)' }}>No requests found matching the current filters.</p>
            </div>
          )}
        </div>
        {sortedData.length > 0 && (
          <Pagination
            page={paging.page}
            totalPages={paging.totalPages}
            total={paging.total}
            startIndex={paging.startIndex}
            endIndex={paging.endIndex}
            onPageChange={paging.setPage}
            className="pagination--portal"
            noun="requests"
          />
        )}
      </ApiState>

      {selectedRequest && (
        <ReviewModal 
          request={selectedRequest} 
          allRequests={enrichedData}
          onClose={() => setSelectedRequest(null)}
          onUpdate={handleUpdateStatus}
          isUpdating={isUpdating}
          navigate={navigate}
        />
      )}

    </div>
  );
}

function PriorityBadge({ priority }) {
  const pConf = priorityConfig[priority] || priorityConfig.Medium;
  const Icon = pConf.icon;
  const pClass = (priority || 'medium').toLowerCase();
  return (
    <div 
      className={`relief-priority-badge relief-priority-badge--${pClass}`}
      title="Priority is locked based on the original submitted request"
    >
      <Icon size={13} strokeWidth={2.5} />
      <span>{priority || 'Medium'} Priority</span>
    </div>
  );
}

function ReviewModal({ request, allRequests, onClose, onUpdate, isUpdating, navigate }) {
  const [notes, setNotes] = useState(request.notes || '');
  
  const activeCriticalRequests = useMemo(() => {
    return (allRequests || []).filter(r => 
      r.beneficiaryId === request.beneficiaryId && 
      r.priority === 'Critical' && 
      !['Completed', 'Rejected', 'Allocated', 'Cancelled'].includes(r.status) && 
      r.dbId !== request.dbId
    );
  }, [allRequests, request]);

  const requestedNeeds = useMemo(() => {
    if (Array.isArray(request.needs) && request.needs.length > 0) {
      return request.needs;
    }
    return (request.type || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }, [request]);

  const calamityInfo = useMemo(() => {
    if (Array.isArray(request.calamityTags) && request.calamityTags.length > 0) {
      return request.calamityTags.join(', ');
    }
    const match = (request.notes || '').match(/Calamity\/Program:\s*([^\n\r]+)/i);
    if (match) return match[1].trim();
    return null;
  }, [request]);

  const prevRequestsCount = useMemo(() => {
    return (allRequests || []).filter(r => r.beneficiaryId === request.beneficiaryId && r.dbId !== request.dbId).length;
  }, [allRequests, request]);

  const slaInfo = useMemo(() => getSLALabel(request), [request]);

  const handleSave = async (status) => {
    await onUpdate(request.dbId, { status, notes, type: request.type });
    if (status !== 'Approved') onClose();
  };

  const formattedDate = useMemo(() => {
    const raw = request.requestDate || request.date || request.createdAt;
    if (!raw) return 'N/A';
    try {
      return new Date(raw).toLocaleString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit' 
      });
    } catch {
      return raw;
    }
  }, [request]);

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal relief-review-modal" onClick={e => e.stopPropagation()}>
        <ModalHeader
          title={`Review Request: ${request.id}`}
          onClose={onClose}
        />
        
        {/* Top Overview & Metadata Strip */}
        <div className="relief-review-header-strip">
          <div className="relief-review-badges">
            <PriorityBadge priority={request.priority} />
            <StatusBadge status={request.status} />
            {request.isEmergency && (
              <span className="badge" style={{ background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600 }}>
                <Pin size={11} /> Pinned Emergency
              </span>
            )}
          </div>
          
          <div className="relief-meta-strip">
            <div className="relief-meta-item" title="Submission date and time">
              <Clock size={13} />
              <span>{formattedDate}</span>
            </div>
            {slaInfo && (
              <div className={`relief-sla-tag relief-sla-tag--${slaInfo.status}`}>
                {slaInfo.text}
              </div>
            )}
          </div>
        </div>

        {/* Modal Main Content Grid */}
        <div className="relief-review-grid">
          {/* Left Column: Needs & Notes */}
          <div className="relief-review-col">
            {activeCriticalRequests.length > 0 && request.priority === 'Critical' && (
              <div className="relief-duplicate-alert">
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span><strong>Duplicate Alert:</strong> There is another open Critical request for this barangay.</span>
              </div>
            )}

            <div className="relief-review-section">
              <div className="relief-section-label">
                <span>Requested Relief Items</span>
                {calamityInfo && (
                  <span className="badge badge--neutral" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>
                    🏷️ {calamityInfo}
                  </span>
                )}
              </div>
              <div className="relief-needs-box">
                {requestedNeeds.length > 0 ? (
                  requestedNeeds.map((need, i) => {
                    const Icon = iconForNeed(need);
                    return (
                      <div key={i} className="relief-need-chip">
                        <Icon size={13} strokeWidth={2.2} />
                        <span>{need}</span>
                      </div>
                    );
                  })
                ) : (
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>General Relief Assistance</span>
                )}
              </div>
            </div>

            <div className="relief-review-section" style={{ flex: 1 }}>
              <div className="relief-section-label">
                <span>Description & Remarks</span>
                <span className="editable-hint">(Editable by Admin)</span>
              </div>
              <textarea 
                className="relief-notes-textarea"
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Enter administrative notes, delivery instructions, or remarks..."
              />
            </div>
          </div>

          {/* Right Column: Barangay Context */}
          <div className="relief-review-col">
            <div className="relief-barangay-card">
              <div className="relief-barangay-header">
                <h4 className="relief-barangay-title">
                  <MapPin size={16} style={{ color: 'var(--admin-brand)', flexShrink: 0 }} />
                  <span>{request.beneficiary}</span>
                </h4>
                <span className="relief-barangay-muni">
                  {request.municipality || 'Cebu'}
                </span>
              </div>

              <div className="relief-barangay-stats-grid">
                <div className="relief-bstat">
                  <span className="relief-bstat-label">
                    <Users size={12} /> Families
                  </span>
                  <span className="relief-bstat-val">
                    {(request.affectedFamilies || 0).toLocaleString()}
                  </span>
                </div>

                <div className="relief-bstat">
                  <span className="relief-bstat-label">
                    <FileText size={12} /> Past Requests
                  </span>
                  <span className="relief-bstat-val">
                    {prevRequestsCount} previous
                  </span>
                </div>

                <div className="relief-bstat" style={{ gridColumn: 'span 2' }}>
                  <span className="relief-bstat-label">
                    <Users size={12} /> Representative
                  </span>
                  <span className="relief-bstat-val" style={{ fontSize: '0.8125rem' }}>
                    {request.representative || 'Barangay Captain / Official'}
                  </span>
                </div>
              </div>

              <button 
                type="button"
                className="relief-view-barangay-btn"
                onClick={() => {
                  onClose();
                  navigate(`/admin/beneficiaries/${request.beneficiaryId}`);
                }}
              >
                View Barangay Details &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer / Workflow Actions */}
        <div className="relief-review-footer">
          <button 
            type="button" 
            className="btn btn--outline btn--sm" 
            onClick={onClose}
          >
            Close
          </button>
          
          <div className="relief-review-footer-actions">
            {request.status === 'Pending Review' && (
              <button 
                type="button" 
                className="btn btn--outline btn--sm" 
                disabled={isUpdating} 
                onClick={() => handleSave('Under Review')} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#b45309', borderColor: '#fde68a' }}
              >
                <Clock size={14} /> Mark Under Review
              </button>
            )}
            {request.status !== 'Rejected' && request.status !== 'Approved' && (
              <button 
                type="button" 
                className="btn btn--danger btn--sm" 
                disabled={isUpdating} 
                onClick={() => handleSave('Rejected')} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <X size={14} /> Reject
              </button>
            )}
            {request.status !== 'Approved' ? (
              <button 
                type="button" 
                className="btn btn--success btn--sm" 
                disabled={isUpdating} 
                onClick={() => handleSave('Approved')} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Check size={14} /> Approve Request
              </button>
            ) : (
              <button 
                type="button" 
                className="btn btn--primary btn--sm" 
                onClick={() => {
                  onClose();
                  navigate('/admin/allocation', { 
                    state: { 
                      prefillRequest: { 
                        requestId: request.dbId, 
                        beneficiaryId: request.beneficiaryId, 
                        type: request.type, 
                        notes: request.notes, 
                        beneficiaryName: request.beneficiary 
                      } 
                    } 
                  });
                }} 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                Create Allocation &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

