import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { assistanceRequestsApi, beneficiariesApi, inventoryApi, donationsApi } from '../../api/resources';
import ProcurementModal from '../components/donations/ProcurementModal';
import { useApiList } from '../../hooks/useApiList';
import { useFilters } from '../../hooks/useFilters';
import { 
  AlertTriangle, AlertCircle, Clock, CheckCircle, 
  Users, Search, Pin, FileText, 
  Check, X, MapPin, Loader2, Info,
  Utensils, Droplets, Shirt, Pill, Sparkles, Home, Banknote, GraduationCap, Package, Tag
} from 'lucide-react';
import PageHeader from '../components/shared/PageHeader';
import ModalHeader from '../components/shared/ModalHeader';
import StatusBadge from '../components/shared/StatusBadge';
import FilterBar from '../components/shared/FilterBar';
import ApiState from '../components/shared/ApiState';
import { usePagination, DEFAULT_PAGE_SIZE } from '../../hooks/usePagination'
import Pagination from '../components/shared/Pagination'
import { notify, confirmAction, showSuccessModal } from '../../utils/confirm';
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
  background: var(--admin-surface, #ffffff);
  border-radius: 14px;
  border: 1px solid var(--admin-border, #e2e8f0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  height: 100%;
  min-height: 100%;
  box-sizing: border-box;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease;
  font-family: var(--font-sans);
}
.request-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px -4px rgba(0, 0, 0, 0.08), 0 4px 8px -2px rgba(0, 0, 0, 0.04);
  border-color: #cbd5e1;
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
  background: linear-gradient(90deg, #dc2626 0%, #b91c1c 100%);
  color: white;
  font-size: 0.68rem;
  font-weight: 700;
  text-align: center;
  padding: 3px 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-family: var(--font-sans);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.request-card__body {
  padding: 1.15rem 1.25rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  flex: 1;
}

.request-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}
.request-card__title-group {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.request-card__title {
  font-family: var(--font-sans);
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  line-height: 1.25;
  letter-spacing: -0.01em;
}
.request-card__subtitle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: #64748b;
  font-weight: 500;
}
.request-card__ref {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.request-card__badges {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-family: var(--font-sans);
}
.priority-badge.critical { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
.priority-badge.high { background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; }
.priority-badge.medium { background: #fefce8; color: #a16207; border: 1px solid #fef08a; }
.priority-badge.low { background: #f0fdf4; color: #15803d; border: 1px solid #dcfce7; }

.calamity-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #dbeafe;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

/* Needs Chips Grid */
.request-card__needs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
.request-need-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #f8fafc;
  color: #334155;
  border: 1px solid #e2e8f0;
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  font-size: 0.76rem;
  font-weight: 500;
  line-height: 1.2;
}
.request-need-tag svg {
  color: #AF101A;
  flex-shrink: 0;
}

.request-card__excerpt {
  font-size: 0.77rem;
  color: #64748b;
  line-height: 1.4;
  margin: 0;
  background: #f8fafc;
  border-left: 2px solid #cbd5e1;
  padding: 0.3rem 0.6rem;
  border-radius: 0 6px 6px 0;
  font-style: italic;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.request-card__meta-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px dashed #e2e8f0;
  margin-top: auto;
}
.request-card__meta-metric {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: #334155;
}
.request-card__meta-metric strong {
  color: #0f172a;
  font-weight: 700;
}
.request-card__meta-time {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: #64748b;
}

.request-card__sla-wrapper {
  margin-top: 0.1rem;
}
.request-card__sla {
  font-size: 0.73rem;
  font-weight: 600;
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--font-sans);
  width: fit-content;
}
.sla-green { background: #f0fdf4; color: #15803d; border: 1px solid #dcfce7; }
.sla-yellow { background: #fffbeb; color: #b45309; border: 1px solid #fef3c7; }
.sla-red { background: #fef2f2; color: #b91c1c; border: 1px solid #fee2e2; }

.request-card__actions {
  border-top: 1px solid #f1f5f9;
  padding: 0.65rem 1.1rem;
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  align-items: center;
  background: #fbfcfe;
  border-bottom-left-radius: 14px;
  border-bottom-right-radius: 14px;
}

.btn-pin {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #64748b;
  cursor: pointer;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}
.btn-pin:hover {
  background: #f1f5f9;
  color: #0f172a;
  border-color: #cbd5e1;
}
.btn-pin.active {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.12);
}

.btn-action-review {
  background: #ffffff !important;
  border: 1px solid #cbd5e1 !important;
  color: #334155 !important;
  font-weight: 600 !important;
  font-size: 0.8125rem !important;
  padding: 0.4rem 0.85rem !important;
  border-radius: 8px !important;
  cursor: pointer;
  transition: all 0.15s ease;
}
.btn-action-review:hover {
  background: #f8fafc !important;
  border-color: #94a3b8 !important;
  color: #0f172a !important;
}

.btn-action-approve {
  background: #16a34a !important;
  border: 1px solid #15803d !important;
  color: #ffffff !important;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(22, 163, 74, 0.25);
  transition: all 0.15s ease;
}
.btn-action-approve:hover {
  background: #15803d !important;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(22, 163, 74, 0.35);
}
.btn-action-approve:active {
  transform: scale(0.96);
}

.btn-action-reject {
  background: #dc2626 !important;
  border: 1px solid #b91c1c !important;
  color: #ffffff !important;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(220, 38, 38, 0.25);
  transition: all 0.15s ease;
}
.btn-action-reject:hover {
  background: #b91c1c !important;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(220, 38, 38, 0.35);
}
.btn-action-reject:active {
  transform: scale(0.96);
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

/* Stock Feasibility & AI Procurement Card */
.relief-stock-feasibility {
  border-radius: 8px;
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.8rem;
}
.relief-stock-feasibility--in-stock {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}
.relief-stock-feasibility--deficit {
  background: #fffbeb;
  border: 1px solid #fde68a;
}
.relief-stock-feasibility__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.relief-stock-feasibility__title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  font-size: 0.82rem;
}
.relief-stock-feasibility--in-stock .relief-stock-feasibility__title {
  color: #15803d;
}
.relief-stock-feasibility--deficit .relief-stock-feasibility__title {
  color: #b45309;
}
.relief-stock-feasibility__items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.15rem;
}
.relief-stock-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  font-size: 0.74rem;
  font-weight: 600;
}
.relief-stock-tag--available {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}
.relief-stock-tag--shortage {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}
.relief-procure-action-box {
  margin-top: 0.35rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #fcd34d;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.relief-procure-action-text {
  font-size: 0.76rem;
  color: #78350f;
  line-height: 1.3;
}
.relief-procure-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 0.38rem 0.75rem;
  font-size: 0.77rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(180, 83, 9, 0.25);
}
.relief-procure-btn:hover {
  background: linear-gradient(135deg, #92400e 0%, #78350f 100%);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(180, 83, 9, 0.35);
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

function parseRequestDetails(req) {
  // 1. Extract individual needs
  let needsList = [];
  if (Array.isArray(req.needs) && req.needs.length > 0) {
    needsList = req.needs;
  } else if (req.type) {
    needsList = req.type.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  } else if (req.notes) {
    const m = req.notes.match(/Type\s*of\s*Needs\s*:\s*([^\n\r]+)/i);
    if (m) {
      needsList = m[1].split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    }
  }
  // Deduplicate and filter out noisy entries
  needsList = Array.from(new Set(needsList.filter(n => n && !n.toLowerCase().startsWith('calamity/'))));

  // 2. Calamity Tag
  let calamity = null;
  if (Array.isArray(req.calamityTags) && req.calamityTags.length > 0) {
    calamity = req.calamityTags[0];
  } else if (req.notes) {
    const m = req.notes.match(/Calamity\/Program\s*:\s*([^\n\r]+)/i);
    if (m) calamity = m[1].trim();
  }

  // 3. Clean Notes Excerpt (stripping repetitive boilerplate headers)
  let excerpt = '';
  if (req.notes) {
    const m = req.notes.match(/Additional\s*Notes\s*:\s*([^\n\r]+)/i);
    if (m) {
      excerpt = m[1].trim();
    } else {
      const clean = req.notes
        .replace(/Calamity\/Program:\s*[^\n\r]+/gi, '')
        .replace(/Type\s*of\s*Needs:\s*[^\n\r]+/gi, '')
        .replace(/Families\s*Affected:\s*[^\n\r]+/gi, '')
        .trim();
      if (clean && clean.length > 3 && !needsList.some(n => n.toLowerCase() === clean.toLowerCase())) {
        excerpt = clean;
      }
    }
  }

  return { needsList, calamity, excerpt };
}

export default function RequestsPage() {
  const navigate = useNavigate();
  const { showLoading, hideLoading } = useLoading();
  const { data: requestsData, loading: reqLoading, error: reqError, reload: reqReload } = useApiList(() => assistanceRequestsApi.list());
  const { data: beneficiariesData } = useApiList(() => beneficiariesApi.list());
  const { data: inventoryData } = useApiList(() => inventoryApi.list());
  const { data: donationsData, reload: reloadDonations } = useApiList(() => donationsApi.list());
  
  const [emergencyIds, setEmergencyIds] = useState(() => new Set());
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [procuringDonation, setProcuringDonation] = useState(null);
  const [procuringRequest, setProcuringRequest] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const availableMonetaryDonations = useMemo(() => {
    return (donationsData || []).filter(d => 
      d.type === 'Monetary' && 
      Number(d.remainingBalance ?? d.amountRaw ?? 0) > 0 && 
      d.status !== 'Rejected'
    );
  }, [donationsData]);

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

      let families = Number(req.affectedFamilies || req.familiesAffected || 0);
      if (!families && req.notes) {
        const match = req.notes.match(/Families\s*Affected\s*:\s*(\d+)/i) || req.notes.match(/(\d+)\s*families/i);
        if (match) families = parseInt(match[1], 10);
      }
      if (!families && b) {
        families = Number(b.affectedFamilies || b.affected_families || b.population || 0);
        if (!families && b.notes) {
          const matchB = b.notes.match(/Families\s*Affected\s*:\s*(\d+)/i) || b.notes.match(/(\d+)\s*families/i);
          if (matchB) families = parseInt(matchB[1], 10);
        }
      }

      return {
        ...req,
        affectedFamilies: families,
        municipality: b?.municipality || req.municipality || 'Cebu City',
        representative: b?.representative || b?.representativeName || req.representative || 'Barangay Official'
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

  const exportColumns = useMemo(() => [
    { key: 'id', label: 'Request Code' },
    { key: 'beneficiary', label: 'Barangay / Beneficiary' },
    { key: 'type', label: 'Assistance Type' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'affectedFamilies', label: 'Affected Families', exportValue: (r) => r.affectedFamilies || r.families || '—' },
    { key: 'date', label: 'Date Requested', exportValue: (r) => r.requestDate || r.date || r.createdAt || '—' },
    { key: 'notes', label: 'Justification / Notes', exportValue: (r) => r.notes || r.description || '' },
  ], []);

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

        <FilterBar
          controller={filterController}
          searchPlaceholder="Search barangay, type, notes..."
          exportConfig={{
            filename: 'assistance-requests-report',
            title: 'Assistance Requests Report',
            columns: exportColumns,
            rows: sortedData,
          }}
        />

        <div className="requests-grid">
          {paging.pageItems.map(req => {
            const pConf = priorityConfig[req.priority] || priorityConfig.Medium;
            const PIcon = pConf.icon;
            const isEmergency = emergencyIds.has(req.dbId);
            const sla = getSLALabel(req);
            const { needsList, calamity, excerpt } = parseRequestDetails(req);
            const rawDate = req.requestDate || req.date || req.createdAt;
            const fullDate = rawDate ? new Date(rawDate).toLocaleString() : 'N/A';

            return (
              <div key={req.dbId} className={`request-card priority-${pConf.color} ${isEmergency ? 'is-emergency' : ''}`}>
                {isEmergency && (
                  <div className="emergency-label">
                    <Pin size={11} /> EMERGENCY PINNED
                  </div>
                )}
                
                <div className="request-card__body">
                  <div className="request-card__header">
                    <div className="request-card__title-group">
                      <h3 className="request-card__title">{req.beneficiary}</h3>
                      <span className="request-card__subtitle">
                        <MapPin size={12} style={{ color: 'var(--admin-brand, #AF101A)' }} />
                        {req.municipality || 'Cebu City'}
                      </span>
                    </div>
                    <span className="request-card__ref" title="Reference Code">{req.id}</span>
                  </div>

                  <div className="request-card__badges">
                    <span className={`priority-badge ${pConf.color}`} title={`${pConf.label} Priority`}>
                      <PIcon size={11} strokeWidth={2.5} /> {pConf.label}
                    </span>
                    <StatusBadge status={req.status} />
                    {calamity && (
                      <span className="calamity-badge" title="Calamity or Program">
                        🏷️ {calamity}
                      </span>
                    )}
                  </div>

                  <div className="request-card__needs">
                    {needsList.length > 0 ? (
                      needsList.map((need, idx) => {
                        const NIcon = iconForNeed(need);
                        return (
                          <span key={idx} className="request-need-tag">
                            <NIcon size={12} strokeWidth={2.2} />
                            <span>{need}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="request-need-tag">
                        <Package size={12} />
                        <span>{req.type || 'General Relief Assistance'}</span>
                      </span>
                    )}
                  </div>

                  {excerpt && (
                    <p className="request-card__excerpt" title={excerpt}>
                      &ldquo;{excerpt}&rdquo;
                    </p>
                  )}
                  
                  <div className="request-card__meta-bar">
                    <div className="request-card__meta-metric" title="Number of affected families">
                      <Users size={14} style={{ color: '#64748b' }} />
                      <span><strong>{(req.affectedFamilies || 0).toLocaleString()}</strong> families</span>
                    </div>
                    <div className="request-card__meta-time" title={`Requested: ${fullDate}`}>
                      <Clock size={13} style={{ color: '#94a3b8' }} />
                      <span>{timeAgo(req.requestDate || req.date || req.createdAt)}</span>
                    </div>
                  </div>

                  {!['Completed', 'Rejected', 'Allocated'].includes(req.status) && (
                    <div className="request-card__sla-wrapper">
                      <span className={`request-card__sla sla-${sla.status}`}>
                        {sla.status === 'red' ? <AlertTriangle size={12} strokeWidth={2.5} /> : <Clock size={12} strokeWidth={2} />}
                        {sla.text}
                      </span>
                    </div>
                  )}
                </div>

                <div className="request-card__actions">
                  <button 
                    className={`btn-pin ${isEmergency ? 'active' : ''}`} 
                    onClick={(e) => toggleEmergency(req.dbId, e)} 
                    title={isEmergency ? "Unpin Emergency" : "Pin as Emergency"}
                    aria-label="Pin Emergency"
                  >
                    <Pin size={15} />
                  </button>
                  
                  <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                    {req.status === 'Approved' ? (
                      <button 
                        className="btn btn--sm btn--primary" 
                        onClick={() => navigate('/admin/allocation', { 
                          state: { 
                            prefillRequest: { 
                              requestId: req.dbId, 
                              beneficiaryId: req.beneficiaryId, 
                              type: req.type, 
                              notes: req.notes, 
                              beneficiaryName: req.beneficiary 
                            } 
                          } 
                        })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
                      >
                        Create Allocation &rarr;
                      </button>
                    ) : (
                      <>
                        <button 
                          className="btn-action-review" 
                          onClick={() => setSelectedRequest(req)}
                        >
                          Review
                        </button>
                        {req.status !== 'Rejected' && (
                          <button 
                            className="btn-action-approve" 
                            onClick={() => handleUpdateStatus(req.dbId, { status: 'Approved' })}
                            title="Approve Request"
                            aria-label="Approve Request"
                          >
                            <Check size={16} strokeWidth={2.6} />
                          </button>
                        )}
                        {req.status !== 'Rejected' && (
                          <button 
                            className="btn-action-reject" 
                            onClick={() => handleUpdateStatus(req.dbId, { status: 'Rejected' })}
                            title="Reject Request"
                            aria-label="Reject Request"
                          >
                            <X size={16} strokeWidth={2.6} />
                          </button>
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
          inventoryData={inventoryData}
          availableMonetaryDonations={availableMonetaryDonations}
          onClose={() => setSelectedRequest(null)}
          onUpdate={handleUpdateStatus}
          onProcure={(req, donation) => {
            setSelectedRequest(null);
            setProcuringRequest(req);
            setProcuringDonation(donation || availableMonetaryDonations[0] || null);
          }}
          isUpdating={isUpdating}
          navigate={navigate}
        />
      )}

      {procuringDonation && (
        <ProcurementModal
          donation={procuringDonation}
          availableDonations={availableMonetaryDonations}
          initialBeneficiaryId={procuringRequest?.beneficiaryId}
          initialRequestId={procuringRequest?.dbId}
          onClose={() => {
            setProcuringDonation(null);
            setProcuringRequest(null);
          }}
          onSuccess={async () => {
            setProcuringDonation(null);
            setProcuringRequest(null);
            await Promise.all([reqReload(), reloadDonations()]);
          }}
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

function ReviewModal({ 
  request, 
  allRequests, 
  inventoryData, 
  availableMonetaryDonations, 
  onClose, 
  onUpdate, 
  onProcure,
  isUpdating, 
  navigate 
}) {
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

  // Real-time Warehouse Inventory Stock Feasibility Check
  const stockFeasibility = useMemo(() => {
    const items = inventoryData || [];
    const availableItems = [];
    const shortageNeeds = [];

    const effectiveNeeds = requestedNeeds.length > 0 ? requestedNeeds : [request.type || 'Relief Goods'];

    effectiveNeeds.forEach(need => {
      const needLower = need.toLowerCase().trim();
      const matched = items.filter(inv => {
        const name = (inv.item || inv.name || '').toLowerCase();
        const cat = (inv.category || '').toLowerCase();
        const avail = Math.max(0, Number(inv.quantity || 0) - Number(inv.allocated || 0));
        return (name.includes(needLower) || needLower.includes(name) || cat.includes(needLower) || needLower.includes(cat)) && avail > 0;
      });

      if (matched.length > 0) {
        const totalAvail = matched.reduce((acc, m) => acc + Math.max(0, Number(m.quantity || 0) - Number(m.allocated || 0)), 0);
        availableItems.push({ need, matched, totalAvail, unit: matched[0]?.unit || 'units' });
      } else {
        shortageNeeds.push(need);
      }
    });

    const hasShortage = shortageNeeds.length > 0 || availableItems.length === 0;
    const totalCashAvailable = (availableMonetaryDonations || []).reduce((acc, d) => acc + Number(d.remainingBalance ?? d.amountRaw ?? 0), 0);

    return {
      availableItems,
      shortageNeeds,
      hasShortage,
      totalCashAvailable,
    };
  }, [inventoryData, requestedNeeds, request.type, availableMonetaryDonations]);

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
          {/* Left Column: Needs, Stock Feasibility & Notes */}
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

            {/* Warehouse Stock Feasibility & AI Monetary Procurement Suggestion */}
            <div className={`relief-stock-feasibility ${stockFeasibility.hasShortage ? 'relief-stock-feasibility--deficit' : 'relief-stock-feasibility--in-stock'}`}>
              <div className="relief-stock-feasibility__header">
                <span className="relief-stock-feasibility__title">
                  {stockFeasibility.hasShortage ? (
                    <>
                      <AlertCircle size={15} color="#b45309" />
                      <span>Warehouse Stock Shortage Detected</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={15} color="#15803d" />
                      <span>Warehouse Stock Available</span>
                    </>
                  )}
                </span>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Live Stock Feasibility
                </span>
              </div>

              <div className="relief-stock-feasibility__items">
                {stockFeasibility.availableItems.map((item, idx) => (
                  <span key={idx} className="relief-stock-tag relief-stock-tag--available">
                    <Check size={11} /> {item.need}: {item.totalAvail} {item.unit} available
                  </span>
                ))}
                {stockFeasibility.shortageNeeds.map((need, idx) => (
                  <span key={idx} className="relief-stock-tag relief-stock-tag--shortage">
                    <X size={11} /> {need}: 0 in stock
                  </span>
                ))}
              </div>

              {stockFeasibility.hasShortage && (
                <div className="relief-procure-action-box">
                  <div className="relief-procure-action-text">
                    <strong>₱{stockFeasibility.totalCashAvailable.toLocaleString()}</strong> unallocated monetary donations available to procure missing goods.
                  </div>
                  <button
                    type="button"
                    className="relief-procure-btn"
                    onClick={() => onProcure(request, availableMonetaryDonations[0] || null)}
                    title="Match and procure goods using available monetary donations"
                  >
                    <Sparkles size={13} />
                    <span>AI Cash Procurement</span>
                  </button>
                </div>
              )}
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
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {stockFeasibility.hasShortage && (
                  <button
                    type="button"
                    className="relief-procure-btn"
                    onClick={() => onProcure(request, availableMonetaryDonations[0] || null)}
                    style={{ padding: '0.45rem 0.85rem' }}
                  >
                    <Sparkles size={14} /> Procure Missing Goods
                  </button>
                )}
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
                  Allocate Warehouse Stock &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

