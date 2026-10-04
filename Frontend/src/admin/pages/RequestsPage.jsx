import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { assistanceRequestsApi, beneficiariesApi, inventoryApi, donationsApi } from '../../api/resources';
import { getAuthenticatedFileUrl } from '../../api/auth';
import ProcurementModal from '../components/donations/ProcurementModal';
import { useApiList } from '../../hooks/useApiList';
import { useFilters } from '../../hooks/useFilters';
import { 
  AlertTriangle, AlertCircle, Clock, CheckCircle, 
  Users, Search, Pin, FileText, 
  Check, X, MapPin, Loader2, Info,
  Utensils, Droplets, Shirt, Pill, Sparkles, Home, Banknote, GraduationCap, Package, Tag,
  Phone, Mail, ExternalLink, Copy, Trash2, Image as ImageIcon, Lock
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
  getReliefRequestActionPermissions,
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
  width: 100%;
}
.requests-page .stat-card {
  background: var(--admin-surface, #ffffff);
  border-radius: var(--admin-radius-lg, 14px);
  padding: 1.15rem 1.25rem;
  border: 1px solid var(--admin-border, #e2e8f0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 132px;
  width: 100%;
  max-width: none;
  flex: initial;
  align-items: stretch;
  text-align: left;
  backdrop-filter: none;
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
  width: 42px;
  height: 42px;
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
  margin: 0.6rem 0 0 0;
  line-height: 1;
}

@media (max-width: 1050px) {
  .requests-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 560px) {
  .requests-stats { grid-template-columns: 1fr; }
  .requests-page .stat-card { min-height: 112px; }
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
.request-card.priority-unassigned { border-left: 4px solid #94a3b8; }

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
.priority-badge.unassigned { background: #f8fafc; color: #64748b; border: 1px solid #cbd5e1; }

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

.btn-action-delete {
  background: #fef2f2 !important;
  border: 1px solid #fecaca !important;
  color: #dc2626 !important;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(220, 38, 38, 0.15);
  transition: all 0.15s ease;
}
.btn-action-delete:hover {
  background: #dc2626 !important;
  border-color: #b91c1c !important;
  color: #ffffff !important;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(220, 38, 38, 0.35);
}
.btn-action-delete:active {
  transform: scale(0.96);
}

.relief-btn-delete {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.35rem !important;
  background: #dc2626 !important;
  color: #ffffff !important;
  border: 1px solid #dc2626 !important;
  font-weight: 650 !important;
  padding: 0.42rem 0.95rem !important;
  font-size: 0.82rem !important;
  border-radius: 7px !important;
  box-shadow: 0 1px 3px rgba(220, 38, 38, 0.25) !important;
  transition: all 0.15s ease !important;
  cursor: pointer !important;
}
.relief-btn-delete:hover:not(:disabled) {
  background: #b91c1c !important;
  border-color: #b91c1c !important;
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(220, 38, 38, 0.35) !important;
}
.relief-btn-delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  max-width: 800px !important;
  width: 94vw !important;
  max-height: min(88vh, 720px) !important;
  padding: 0 !important;
  border-radius: 14px !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.06) !important;
  border: none !important;
  box-sizing: border-box !important;
  background: #ffffff !important;
}

.relief-review-modal .admin-modal__header {
  margin: 0 !important;
  top: 0 !important;
  position: static !important;
  padding: 0.9rem 1.25rem !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  background: linear-gradient(135deg, #AF101A 0%, #8E0D15 100%) !important;
  border-top-left-radius: 14px !important;
  border-top-right-radius: 14px !important;
  box-shadow: none !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
  flex-shrink: 0 !important;
}

.relief-modal-header-content {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.relief-modal-header-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.relief-modal-tagline {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.78);
}

.relief-code-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  padding: 0.15rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  border: 1px solid rgba(255, 255, 255, 0.25);
  cursor: pointer;
  transition: all 0.15s ease;
}
.relief-code-chip:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.relief-review-modal .admin-modal__header h2 {
  font-size: 1.15rem !important;
  font-weight: 750 !important;
  color: #ffffff !important;
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.25 !important;
  letter-spacing: -0.01em;
}

.relief-review-modal .admin-modal__close {
  margin: 0 !important;
  width: 32px !important;
  height: 32px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: rgba(255, 255, 255, 0.14) !important;
  color: #ffffff !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  border-radius: 8px !important;
  transition: all 0.15s ease !important;
  cursor: pointer !important;
}
.relief-review-modal .admin-modal__close:hover {
  background: rgba(255, 255, 255, 0.28) !important;
  transform: scale(1.05);
}

/* Header status & metadata strip */
.relief-review-header-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  gap: 0.75rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.relief-review-header-info {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.relief-review-top-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-left: auto;
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
  gap: 0.75rem;
  font-size: 0.8rem;
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
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  letter-spacing: 0.02em;
}
.relief-sla-tag--red {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}
.relief-sla-tag--yellow {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}
.relief-sla-tag--green {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

/* Modal Scrollable Body */
.relief-review-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: #ffffff;
  box-sizing: border-box;
}

.relief-review-body::-webkit-scrollbar {
  width: 6px;
}
.relief-review-body::-webkit-scrollbar-track {
  background: transparent;
}
.relief-review-body::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.relief-review-body::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.relief-review-modal .relief-proof-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.7rem;
  margin-top: 0.65rem;
}

.relief-review-modal .relief-proof-link {
  display: grid;
  min-width: 0;
  gap: 0.4rem;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  background: #fff;
  color: #334155;
  text-decoration: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}

.relief-review-modal .relief-proof-link:hover,
.relief-review-modal .relief-proof-link:focus-visible {
  border-color: #af101a;
  box-shadow: 0 5px 16px rgba(175, 16, 26, 0.12);
  outline: none;
}

.relief-review-modal .relief-proof-image-wrap {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 190px;
  aspect-ratio: 16 / 7;
  overflow: hidden;
  border-radius: 7px;
  background: #f1f5f9;
}

.relief-review-modal .relief-proof-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.relief-review-modal .relief-proof-filename {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
}

.relief-review-modal .relief-proof-filename svg {
  flex: 0 0 auto;
  color: #af101a;
}

.relief-review-modal .relief-proof-filename span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 2-Column Responsive Grid */
.relief-review-grid {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 0.85rem;
  align-items: stretch;
}

.relief-review-col {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}

/* Reusable Clean Card */
.relief-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}
.relief-card:hover {
  border-color: #cbd5e1;
}

/* Request Core Card */
.relief-overview-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.relief-calamity-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}

.relief-calamity-title {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.86rem;
  font-weight: 700;
  color: #0f172a;
}

.relief-calamity-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #e2e8f0;
}

/* Impact families highlight */
.relief-impact-stat-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #fff5f5;
  border: 1px solid #fed7d7;
  border-radius: 8px;
  padding: 0.55rem 0.85rem;
}
.relief-impact-stat-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #fee2e2;
  color: #b91c1c;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.relief-impact-stat-num {
  font-size: 0.95rem;
  font-weight: 800;
  color: #991b1b;
  line-height: 1.2;
}
.relief-impact-stat-sub {
  font-size: 0.72rem;
  color: #7f1d1d;
  font-weight: 500;
}

/* Needs chips */
.relief-needs-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.relief-sub-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
}

.relief-needs-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
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
  font-size: 0.76rem;
  font-weight: 650;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}

/* Stock Feasibility Card */
.relief-stock-feasibility {
  border-radius: 10px;
  padding: 0.8rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  font-size: 0.8rem;
  box-sizing: border-box;
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
  font-weight: 750;
  font-size: 0.82rem;
}
.relief-stock-feasibility--in-stock .relief-stock-feasibility__title {
  color: #15803d;
}
.relief-stock-feasibility--deficit .relief-stock-feasibility__title {
  color: #b45309;
}
.relief-stock-feasibility__badge {
  font-size: 0.68rem;
  font-weight: 600;
  color: #64748b;
  background: rgba(255, 255, 255, 0.7);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}
.relief-stock-feasibility__items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.relief-stock-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  font-size: 0.73rem;
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
  padding-top: 0.55rem;
  border-top: 1px dashed #fcd34d;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.relief-procure-action-text {
  font-size: 0.75rem;
  color: #78350f;
  line-height: 1.35;
  flex: 1;
  min-width: 180px;
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
  font-size: 0.76rem;
  font-weight: 650;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(180, 83, 9, 0.25);
  white-space: nowrap;
}
.relief-procure-btn:hover {
  background: linear-gradient(135deg, #92400e 0%, #78350f 100%);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(180, 83, 9, 0.35);
}

/* Barangay Card */
.relief-barangay-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.relief-barangay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}
.relief-barangay-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.relief-barangay-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #fef2f2;
  color: var(--admin-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.relief-barangay-name {
  font-size: 0.92rem;
  font-weight: 750;
  color: #1e293b;
  margin: 0;
  line-height: 1.2;
}
.relief-barangay-sub {
  font-size: 0.73rem;
  color: #64748b;
  font-weight: 500;
}
.relief-barangay-status-badge {
  font-size: 0.68rem;
  font-weight: 600;
  color: #15803d;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  white-space: nowrap;
}

.relief-rep-info {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  background: #f8fafc;
  padding: 0.6rem 0.75rem;
  border-radius: 7px;
  border: 1px solid #e2e8f0;
}
.relief-rep-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.82rem;
  font-weight: 700;
  color: #1e293b;
}
.relief-rep-role {
  font-size: 0.72rem;
  font-weight: 500;
  color: #64748b;
}
.relief-contact-chips {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.2rem;
}
.relief-contact-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: #2563eb;
  text-decoration: none;
  background: #eff6ff;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  border: 1px solid #bfdbfe;
  transition: all 0.15s ease;
}
.relief-contact-link:hover {
  background: #dbeafe;
  color: #1d4ed8;
}

.relief-barangay-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.25rem;
}
.relief-history-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #64748b;
}
.relief-history-stat strong {
  color: #0f172a;
}
.relief-view-barangay-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.65rem;
  font-size: 0.74rem;
  font-weight: 650;
  border-radius: 6px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.relief-view-barangay-btn:hover {
  border-color: var(--admin-brand);
  color: var(--admin-brand);
  background: #fff9f9;
}

/* Notes / Remarks Card */
.relief-notes-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.75rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.relief-notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.relief-notes-header .relief-section-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.relief-notes-header .editable-hint {
  font-size: 0.68rem;
  font-weight: normal;
  text-transform: none;
  color: #94a3b8;
}

.relief-save-notes-mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 650;
  border-radius: 4px;
  background: #15803d;
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
}
.relief-save-notes-mini-btn:hover {
  background: #166534;
}

/* Quick Notes Tag Chips */
.relief-quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.relief-quick-tag-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #475569;
  font-size: 0.68rem;
  font-weight: 550;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.12s ease;
  white-space: nowrap;
}
.relief-quick-tag-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #991b1b;
}

.relief-notes-textarea {
  width: 100%;
  height: 60px;
  min-height: 52px;
  max-height: 80px;
  padding: 0.45rem 0.65rem;
  font-size: 0.8rem;
  line-height: 1.35;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
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
  box-shadow: 0 0 0 3px rgba(175, 16, 26, 0.08);
}

.relief-duplicate-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  color: #b45309;
  font-size: 0.76rem;
}

/* Fixed Footer Actions */
.relief-review-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  gap: 0.75rem;
  flex-shrink: 0;
  border-bottom-left-radius: 14px;
  border-bottom-right-radius: 14px;
}

.relief-review-footer-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.relief-review-footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.relief-btn-under-review {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #b45309 !important;
  border-color: #fde68a !important;
  background: #fffbeb !important;
  font-weight: 650 !important;
}
.relief-btn-under-review:hover {
  background: #fef3c7 !important;
  border-color: #fcd34d !important;
}

.relief-btn-reject {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.35rem !important;
  background: #dc2626 !important;
  color: #ffffff !important;
  border: 1px solid #dc2626 !important;
  font-weight: 650 !important;
  padding: 0.42rem 0.95rem !important;
  font-size: 0.82rem !important;
  border-radius: 7px !important;
  box-shadow: 0 1px 3px rgba(220, 38, 38, 0.25) !important;
  transition: all 0.15s ease !important;
  cursor: pointer !important;
}
.relief-btn-reject:hover:not(:disabled) {
  background: #b91c1c !important;
  border-color: #b91c1c !important;
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(220, 38, 38, 0.35) !important;
}
.relief-btn-reject:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.relief-btn-approve {
  display: inline-flex !important;
  align-items: center !important;
  gap: 0.35rem !important;
  background: #16a34a !important;
  color: #ffffff !important;
  border: 1px solid #16a34a !important;
  font-weight: 650 !important;
  padding: 0.42rem 1.05rem !important;
  font-size: 0.82rem !important;
  border-radius: 7px !important;
  box-shadow: 0 1px 3px rgba(22, 163, 74, 0.25) !important;
  transition: all 0.15s ease !important;
  cursor: pointer !important;
}
.relief-btn-approve:hover:not(:disabled) {
  background: #15803d !important;
  border-color: #15803d !important;
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(22, 163, 74, 0.35) !important;
}
.relief-btn-approve:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.relief-btn-allocate {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 650 !important;
  box-shadow: 0 1px 3px rgba(175, 16, 26, 0.25) !important;
}
.relief-btn-allocate:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(175, 16, 26, 0.35) !important;
}

@media (max-width: 680px) {
  .relief-review-modal .relief-proof-grid {
    grid-template-columns: 1fr;
  }
  .relief-review-modal .relief-proof-image-wrap {
    min-height: 170px;
    aspect-ratio: 16 / 9;
  }
  .relief-review-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  .relief-review-modal {
    max-height: 94vh !important;
    width: 96vw !important;
  }
  .relief-review-body {
    padding: 0.85rem;
  }
  .relief-review-header-strip {
    padding: 0.65rem 0.85rem;
    gap: 0.6rem;
  }
  .relief-review-header-info {
    width: 100%;
    justify-content: space-between;
  }
  .relief-review-top-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .relief-review-top-actions .btn {
    flex: 1 1 auto;
    justify-content: center;
  }
  .relief-review-footer {
    padding: 0.65rem 0.85rem;
  }
}
`;

const priorityConfig = {
  Unassigned: { color: 'unassigned', icon: AlertCircle, label: 'NOT ASSESSED', slaHours: 0, weight: 0 },
  Critical: { color: 'critical', icon: AlertTriangle, label: 'CRITICAL', slaHours: 4, weight: 4 },
  High: { color: 'high', icon: AlertCircle, label: 'HIGH', slaHours: 24, weight: 3 },
  Medium: { color: 'medium', icon: Clock, label: 'MEDIUM', slaHours: 72, weight: 2 },
  Low: { color: 'low', icon: CheckCircle, label: 'LOW', slaHours: 168, weight: 1 }
};

function getSLALabel(req) {
  if (!req?.priorityAssigned || !req?.priority) return null;
  const pConf = priorityConfig[req.priority] || priorityConfig.Unassigned;
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

function formatRangeDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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

function getCalamityConfig(calamity) {
  const c = String(calamity || '').toLowerCase();
  if (c.includes('landslide') || c.includes('earthquake')) {
    return { label: calamity, color: '#92400e', bg: '#fef3c7', border: '#fde68a' };
  }
  if (c.includes('typhoon') || c.includes('storm')) {
    return { label: calamity, color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd' };
  }
  if (c.includes('flood')) {
    return { label: calamity, color: '#0284c7', bg: '#e0f2fe', border: '#bae6fd' };
  }
  if (c.includes('fire')) {
    return { label: calamity, color: '#b91c1c', bg: '#fee2e2', border: '#fecaca' };
  }
  return { label: calamity || 'General Assistance', color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' };
}

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
      !['Pending Verification', 'Rejected', 'Cancelled'].includes(d.status)
    );
  }, [donationsData]);

  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = styles;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  // Enrich every request before report filtering so every lifecycle status remains available.
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
        representative: b?.representative || b?.representativeName || req.representative || 'Barangay Official',
        representativePosition: b?.representativePosition || b?.position || req.representativePosition || '',
        representativePhone: b?.representativePhone || b?.phone || b?.contactNumber || req.representativePhone || '',
        representativeEmail: b?.representativeEmail || b?.email || req.representativeEmail || '',
        beneficiaryStatus: b?.status || ''
      };
    });
  }, [requestsData, beneficiariesData]);

  useEffect(() => {
    const targetId = location.state?.openRequestId || new URLSearchParams(location.search).get('id') || new URLSearchParams(location.search).get('requestId');
    if (targetId && enrichedData && enrichedData.length > 0) {
      const found = enrichedData.find(r => 
        String(r.id || '').toLowerCase() === String(targetId).toLowerCase() || 
        String(r.dbId) === String(targetId) ||
        String(r.code || '').toLowerCase() === String(targetId).toLowerCase()
      );
      if (found) {
        setSelectedRequest(found);
      }
    }
  }, [location.state, location.search, enrichedData]);

  const filterConfig = useMemo(() => ({
    searchKeys: ['beneficiary', 'id', 'type', 'notes'],
    dateKey: 'requestDate',
    dateFromLabel: 'From Date',
    dateToLabel: 'To Date',
    filters: [
      { key: 'priority', label: 'Priority', options: ['Critical', 'High', 'Medium', 'Low'] },
      {
        key: 'status',
        label: 'Status',
        deriveOptions: (rows) => Array.from(new Set(rows.map((row) => row.status).filter(Boolean))).sort(),
      }
    ]
  }), []);

  // Report and filter across the full relief-request lifecycle.
  const filterController = useFilters(enrichedData, filterConfig);

  const dateRangeData = useMemo(() => {
    const from = filterController.dateFrom;
    const to = filterController.dateTo;
    if (!from && !to) return enrichedData;
    return enrichedData.filter((request) => {
      const requestDate = String(request.requestDate || '').slice(0, 10);
      if (!requestDate) return false;
      if (from && requestDate < from) return false;
      if (to && requestDate > to) return false;
      return true;
    });
  }, [enrichedData, filterController.dateFrom, filterController.dateTo]);

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
    `${filterController.search}|${filterController.values?.priority || ''}|${filterController.values?.status || ''}|${filterController.dateFrom}|${filterController.dateTo}`,
  );

  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let critical = 0;
    dateRangeData.forEach(r => {
      if (r.status === 'Pending Review' || r.status === 'Under Review') pending++;
      if (r.status === 'Approved' || r.status === 'Ready for Allocation') approved++;
      if (r.priority === 'Critical' && r.status !== 'Rejected') critical++;
    });
    return { total: dateRangeData.length, pending, approved, critical };
  }, [dateRangeData]);

  const reportDateRange = filterController.dateFrom || filterController.dateTo
    ? `${filterController.dateFrom ? formatRangeDate(filterController.dateFrom) : 'Earliest'} to ${filterController.dateTo ? formatRangeDate(filterController.dateTo) : 'Latest'}`
    : 'All Dates';

  const reportMeta = [
    { label: 'Relief Request Date Range', value: reportDateRange },
    { label: 'Total Relief Requests', value: stats.total },
    { label: 'Pending Review', value: stats.pending },
    { label: 'Approved / Ready for Allocation', value: stats.approved },
    { label: 'Critical Alerts', value: stats.critical },
  ];

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
          type: 'success',
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
        setSelectedRequest(prev => ({ ...prev, ...(res?.data || updates) }));
      }
      return res?.data || { ...existing, ...updates };
    } catch (err) {
      notify.error(err?.message || 'Failed to update request');
      return null;
    } finally {
      hideLoading();
      setIsUpdating(false);
    }
  };

  const handleDeleteRequest = async (dbId) => {
    const existing = (enrichedData || []).find((r) => r.dbId === dbId);
    const ok = await confirmAction({
      title: 'Delete Relief Request',
      message: `Are you sure you want to permanently delete the rejected relief request from ${existing?.beneficiary || 'barangay'}? This action cannot be undone.`,
      confirmText: 'Delete Request',
      type: 'danger',
    });
    if (!ok) return false;

    try {
      setIsUpdating(true);
      showLoading('Deleting request…');
      await assistanceRequestsApi.remove(dbId);
      await reqReload();
      notifyBadgesChanged();
      notify.success('Relief request permanently deleted.');
      showSuccessModal('Request successfully deleted.');
      if (selectedRequest && selectedRequest.dbId === dbId) {
        setSelectedRequest(null);
      }
      return true;
    } catch (err) {
      notify.error(err?.message || 'Failed to delete request');
      return false;
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

      <ApiState loading={reqLoading} error={reqError} message="Loading relief requests…" onRetry={reqReload}>
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
            meta: reportMeta,
          }}
        />

        <div className="requests-grid">
          {paging.pageItems.map(req => {
            const pConf = priorityConfig[req.priority] || priorityConfig.Unassigned;
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

                  {sla && !['Completed', 'Rejected', 'Allocated'].includes(req.status) && (
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
                    {(() => {
                      const perms = getReliefRequestActionPermissions(req.status);
                      if (perms.canApprove) {
                        return (
                          <>
                            <button 
                              className="btn-action-review" 
                              onClick={() => setSelectedRequest(req)}
                            >
                              Review
                            </button>
                            <button 
                              className="btn-action-approve" 
                              onClick={() => handleUpdateStatus(req.dbId, { status: 'Ready for Allocation' })}
                              disabled={!req.priorityAssigned}
                              title={req.priorityAssigned ? 'Approve Request' : 'Review and assign priority first'}
                              aria-label="Approve Request"
                            >
                              <Check size={16} strokeWidth={2.6} />
                            </button>
                            <button 
                              className="btn-action-reject" 
                              onClick={() => handleUpdateStatus(req.dbId, { status: 'Rejected' })}
                              title="Reject Request"
                              aria-label="Reject Request"
                            >
                              <X size={16} strokeWidth={2.6} />
                            </button>
                          </>
                        );
                      }
                      if (perms.canDelete) {
                        return (
                          <>
                            <button 
                              className="btn-action-review" 
                              onClick={() => setSelectedRequest(req)}
                            >
                              Review
                            </button>
                            <button 
                              className="btn-action-delete" 
                              onClick={() => handleDeleteRequest(req.dbId)}
                              title="Delete Request"
                              aria-label="Delete Request"
                            >
                              <Trash2 size={15} strokeWidth={2.4} />
                            </button>
                          </>
                        );
                      }
                      if (perms.isApproved && !req.hasAllocation && (req.allocationCount || 0) <= 0) {
                        return (
                          <>
                            <button 
                              className="btn-action-review" 
                              onClick={() => setSelectedRequest(req)}
                            >
                              Review
                            </button>
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
                          </>
                        );
                      }
                      // Approved / Allocated / In Progress / Completed -> NO Approve, NO Reject, NO Delete
                      return (
                        <button 
                          className="btn-action-review" 
                          onClick={() => setSelectedRequest(req)}
                        >
                          Review
                        </button>
                      );
                    })()}
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
          onDelete={handleDeleteRequest}
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
  if (!priority) {
    return (
      <div className="relief-priority-badge" title="Admin assessment is required" style={{ background: '#f8fafc', color: '#64748b', borderColor: '#cbd5e1' }}>
        <AlertCircle size={13} strokeWidth={2.5} />
        <span>Priority Not Assigned</span>
      </div>
    );
  }
  const pConf = priorityConfig[priority] || priorityConfig.Unassigned;
  const Icon = pConf.icon;
  const pClass = (priority || 'medium').toLowerCase();
  return (
    <div 
      className={`relief-priority-badge relief-priority-badge--${pClass}`}
      title="Priority is permanently locked"
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
  onDelete,
  onProcure,
  isUpdating, 
  navigate 
}) {
  const [liveRequest, setLiveRequest] = useState(request);
  const [isLoadingFresh, setIsLoadingFresh] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState('');

  useEffect(() => {
    setLiveRequest(request);
    const reqId = request?.dbId || request?.id;
    if (!reqId) return;

    let active = true;
    setIsLoadingFresh(true);
    assistanceRequestsApi.get(reqId)
      .then(res => {
        if (!active) return;
        const fresh = res?.data || res;
        if (fresh && (fresh.id || fresh.dbId)) {
          setLiveRequest(prev => ({ ...prev, ...fresh }));
        }
      })
      .catch(err => {
        console.warn('Could not fetch live relief request from database:', err);
      })
      .finally(() => {
        if (active) setIsLoadingFresh(false);
      });

    return () => {
      active = false;
    };
  }, [request?.dbId, request?.id]);

  const modalPerms = useMemo(() => {
    return getReliefRequestActionPermissions(liveRequest?.status);
  }, [liveRequest?.status]);

  const [notes, setNotes] = useState(liveRequest.notes || '');
  const [copiedId, setCopiedId] = useState(false);
  
  useEffect(() => {
    setNotes(liveRequest.notes || '');
  }, [liveRequest.notes]);

  const handleAssignPriority = async () => {
    if (!selectedPriority) {
      notify.error('Select a Priority Level first.');
      return;
    }
    const ok = await confirmAction({
      title: 'Assign Priority Level',
      message: `Assign ${selectedPriority} priority? This cannot be changed or overwritten afterward.`,
      confirmText: 'Assign & Lock Priority',
      type: 'success',
    });
    if (!ok) return;
    const updated = await onUpdate(liveRequest.dbId || liveRequest.id, { priority: selectedPriority });
    if (updated) {
      setLiveRequest(prev => ({ ...prev, ...updated }));
      setSelectedPriority('');
    }
  };

  const isNotesDirty = notes !== (liveRequest.notes || '');

  const activeCriticalRequests = useMemo(() => {
    return (allRequests || []).filter(r => 
      r.beneficiaryId === liveRequest.beneficiaryId && 
      r.priority === 'Critical' && 
      !['Completed', 'Rejected', 'Allocated', 'Cancelled'].includes(r.status) && 
      r.dbId !== liveRequest.dbId
    );
  }, [allRequests, liveRequest]);

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
    return request.calamity || request.reason || 'General Assistance';
  }, [request]);

  const calamityBadge = useMemo(() => getCalamityConfig(calamityInfo), [calamityInfo]);

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

  const handleSaveNotesOnly = async () => {
    await onUpdate(request.dbId, { notes });
  };

  const handleCopyId = (e) => {
    e.stopPropagation();
    if (request.id) {
      navigator.clipboard.writeText(request.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
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

  const familiesCount = Number(request.affectedFamilies) || 0;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal relief-review-modal" onClick={e => e.stopPropagation()}>
        
        {/* Header with Tagline & Copy Request ID */}
        <div className="admin-modal__header">
          <div className="relief-modal-header-content">
            <div className="relief-modal-header-top">
              <span className="relief-modal-tagline">Relief Assistance Review</span>
              <button 
                type="button" 
                className="relief-code-chip"
                onClick={handleCopyId}
                title="Click to copy Request Code"
              >
                <span>{request.id}</span>
                {copiedId ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
              </button>
            </div>
            <h2>Review Request: {request.beneficiary}</h2>
          </div>
          <button 
            type="button" 
            className="admin-modal__close" 
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>
        
        {/* Status, Timing & Top Action Bar */}
        <div className="relief-review-header-strip">
          <div className="relief-review-header-info">
            <div className="relief-review-badges">
              <PriorityBadge priority={liveRequest.priority} />
              <StatusBadge status={liveRequest.status} />
              {isLoadingFresh && (
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  syncing database…
                </span>
              )}
              {liveRequest.isEmergency && (
                <span className="badge" style={{ background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600 }}>
                  <Pin size={11} /> Pinned Emergency
                </span>
              )}
            </div>
            
            <div className="relief-meta-strip">
              <div className="relief-meta-item" title="Request submission timestamp">
                <Clock size={12} />
                <span>{formattedDate}</span>
              </div>
              {slaInfo && (
                <div className={`relief-sla-tag relief-sla-tag--${slaInfo.status}`}>
                  {slaInfo.text}
                </div>
              )}
            </div>
          </div>

          {/* Primary Action Buttons placed prominently at the top */}
          <div className="relief-review-top-actions">
            {/* 1. When Pending Review / Under Review: show Reject and Approve only (NO delete) */}
            {modalPerms.canApprove && (
              <>
                {liveRequest.status === 'Pending Review' && (
                  <button 
                    type="button" 
                    className="btn btn--outline btn--sm relief-btn-under-review" 
                    disabled={isUpdating} 
                    onClick={() => handleSave('Under Review')} 
                    title="Mark this request as Under Review"
                  >
                    <Clock size={13} /> Mark Under Review
                  </button>
                )}
                <button 
                  type="button" 
                  className="btn btn--danger btn--sm relief-btn-reject" 
                  disabled={isUpdating}
                  onClick={() => handleSave('Rejected')} 
                  title="Reject this relief request"
                >
                  <X size={14} strokeWidth={2.4} /> Reject
                </button>
                <button 
                  type="button" 
                  className="btn btn--success btn--sm relief-btn-approve" 
                  disabled={isUpdating || !liveRequest.priorityAssigned}
                  onClick={() => handleSave('Approved')} 
                  title={liveRequest.priorityAssigned ? 'Approve this relief request' : 'Assign and save the priority first'}
                >
                  <Check size={14} strokeWidth={2.6} /> Approve Request
                </button>
              </>
            )}

            {/* 2. When Rejected: show Delete only (NO approve, NO reject) */}
            {modalPerms.canDelete && (
              <button 
                type="button" 
                className="btn btn--danger btn--sm relief-btn-delete" 
                disabled={isUpdating} 
                onClick={async () => {
                  const deleted = await onDelete?.(liveRequest.dbId || liveRequest.id);
                  if (deleted) onClose();
                }} 
                title="Delete this rejected relief request permanently"
              >
                <Trash2 size={14} strokeWidth={2.4} /> Delete Request
              </button>
            )}

            {/* 3. When Approved: show Allocate & Procure (NO Approve, NO Reject, NO Delete) */}
            {modalPerms.isApproved && !liveRequest.hasAllocation && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {stockFeasibility.hasShortage && (
                  <button
                    type="button"
                    className="relief-procure-btn"
                    onClick={() => onProcure(liveRequest, availableMonetaryDonations[0] || null)}
                    style={{ padding: '0.45rem 0.85rem' }}
                  >
                    <Sparkles size={13} /> Procure Missing Goods
                  </button>
                )}
                <button 
                  type="button" 
                  className="btn btn--primary btn--sm relief-btn-allocate" 
                  onClick={() => {
                    onClose();
                    navigate('/admin/allocation', { 
                      state: { 
                        prefillRequest: { 
                          requestId: liveRequest.dbId || liveRequest.id, 
                          beneficiaryId: liveRequest.beneficiaryId, 
                          type: liveRequest.type, 
                          notes: liveRequest.notes, 
                          beneficiaryName: liveRequest.beneficiary 
                        } 
                      } 
                    });
                  }} 
                >
                  <span>Allocate Warehouse Stock</span>
                  <span>&rarr;</span>
                </button>
              </div>
            )}

            {/* 4. Allocated / In Distribution / Completed / Cancelled: Absolutely NO Approve, NO Reject, NO Delete */}
          </div>
        </div>

        {/* Scrollable Body Container */}
        <div className="relief-review-body">
          <div className="relief-card" style={{ padding: '0.9rem 1rem', marginBottom: '0.9rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', flexWrap: 'wrap' }}>
              <div>
                <div className="relief-section-label">Priority Assessment</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                  Review the submitted disaster proof, then assign the severity once.
                </div>
              </div>
              {liveRequest.priorityAssigned ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <PriorityBadge priority={liveRequest.priority} />
                  <Lock size={14} color="#64748b" aria-label="Locked" />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)} disabled={isUpdating} style={{ minWidth: '175px' }}>
                    <option value="">Select priority...</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                  <button type="button" className="btn btn--success btn--sm" disabled={isUpdating || !selectedPriority} onClick={handleAssignPriority}>
                    <Check size={13} /> Assign & Lock
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="relief-card" style={{ padding: '0.9rem 1rem', marginBottom: '0.9rem', border: '1px solid #e2e8f0' }}>
            <div className="relief-section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ImageIcon size={14} /> Disaster Proof / Photos
            </div>
            {Array.isArray(liveRequest.disasterProofs) && liveRequest.disasterProofs.length > 0 ? (
              <div className="relief-proof-grid">
                {liveRequest.disasterProofs.map((proof) => (
                  <a key={proof.id || proof.url} href={getAuthenticatedFileUrl(proof.url)} target="_blank" rel="noreferrer" className="relief-proof-link" title="Open full-size disaster proof">
                    <span className="relief-proof-image-wrap">
                      <img src={getAuthenticatedFileUrl(proof.url)} alt={`Disaster proof: ${proof.name || 'uploaded photo'}`} className="relief-proof-image" />
                    </span>
                    <span className="relief-proof-filename"><ImageIcon size={14} /><span>{proof.name || 'Disaster proof photo'}</span></span>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: '0.55rem', color: '#64748b', fontSize: '0.82rem' }}>No disaster proof photos were uploaded.</div>
            )}
          </div>

          {activeCriticalRequests.length > 0 && request.priority === 'Critical' && (
            <div className="relief-duplicate-alert">
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span><strong>Duplicate Critical Alert:</strong> Another open Critical request exists for this barangay.</span>
            </div>
          )}

          {/* 2-Column Balanced Grid */}
          <div className="relief-review-grid">
            
            {/* Left Column: Calamity, Impact & Live Stock */}
            <div className="relief-review-col">
              
              {/* Request Core Card */}
              <div className="relief-card relief-overview-card">
                <div className="relief-calamity-header">
                  <span className="relief-sub-label">Calamity / Program</span>
                  <span 
                    className="relief-calamity-pill" 
                    style={{ 
                      color: calamityBadge.color, 
                      background: calamityBadge.bg, 
                      borderColor: calamityBadge.border 
                    }}
                  >
                    {calamityBadge.label}
                  </span>
                </div>

                {/* Families Impact Callout */}
                <div className="relief-impact-stat-card">
                  <div className="relief-impact-stat-icon">
                    <Users size={16} strokeWidth={2.4} />
                  </div>
                  <div>
                    <div className="relief-impact-stat-num">
                      {familiesCount.toLocaleString()} Families
                    </div>
                    <div className="relief-impact-stat-sub">
                      Impacted community members requiring relief aid
                    </div>
                  </div>
                </div>

                {/* Requested Needs */}
                <div className="relief-needs-group">
                  <span className="relief-sub-label">Requested Goods & Supplies</span>
                  <div className="relief-needs-list">
                    {requestedNeeds.length > 0 ? (
                      requestedNeeds.map((need, i) => {
                        const Icon = iconForNeed(need);
                        return (
                          <span key={i} className="relief-need-chip">
                            <Icon size={12} strokeWidth={2.2} />
                            <span>{need}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="relief-need-chip" style={{ color: '#64748b', borderColor: '#e2e8f0' }}>
                        General Relief Goods
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Warehouse Stock Feasibility */}
              <div className={`relief-stock-feasibility ${stockFeasibility.hasShortage ? 'relief-stock-feasibility--deficit' : 'relief-stock-feasibility--in-stock'}`}>
                <div className="relief-stock-feasibility__header">
                  <div className="relief-stock-feasibility__title">
                    {stockFeasibility.hasShortage ? (
                      <>
                        <AlertCircle size={15} color="#b45309" />
                        <span>Warehouse Stock Shortage</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={15} color="#15803d" />
                        <span>Supplies In Stock & Ready</span>
                      </>
                    )}
                  </div>
                  <span className="relief-stock-feasibility__badge">Live Feasibility</span>
                </div>

                <div className="relief-stock-feasibility__items">
                  {stockFeasibility.availableItems.map((item, idx) => (
                    <span key={idx} className="relief-stock-tag relief-stock-tag--available">
                      <Check size={11} strokeWidth={2.5} /> {item.need}: {item.totalAvail} {item.unit} available
                    </span>
                  ))}
                  {stockFeasibility.shortageNeeds.map((need, idx) => (
                    <span key={idx} className="relief-stock-tag relief-stock-tag--shortage">
                      <X size={11} strokeWidth={2.5} /> {need}: 0 in stock
                    </span>
                  ))}
                </div>

                {stockFeasibility.hasShortage && (
                  <div className="relief-procure-action-box">
                    <div className="relief-procure-action-text">
                      <strong>₱{stockFeasibility.totalCashAvailable.toLocaleString()}</strong> unallocated funds available to procure missing goods.
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
            </div>

            {/* Right Column: Barangay Context & Remarks */}
            <div className="relief-review-col">
              
              {/* Barangay Info Card */}
              <div className="relief-card relief-barangay-card">
                <div className="relief-barangay-header">
                  <div className="relief-barangay-main">
                    <div className="relief-barangay-icon">
                      <MapPin size={15} />
                    </div>
                    <div>
                      <h4 className="relief-barangay-name">{request.beneficiary}</h4>
                      <span className="relief-barangay-sub">{request.municipality || 'Cebu City'}</span>
                    </div>
                  </div>
                  <span className="relief-barangay-status-badge">
                    {request.beneficiaryStatus || 'Partner Barangay'}
                  </span>
                </div>

                <div className="relief-rep-info">
                  <div className="relief-rep-title">
                    <span>{request.representative || 'Barangay Official'}</span>
                    <span className="relief-rep-role">{request.representativePosition || 'Representative'}</span>
                  </div>
                  
                  {(request.representativePhone || request.representativeEmail) && (
                    <div className="relief-contact-chips">
                      {request.representativePhone && (
                        <a href={`tel:${request.representativePhone}`} className="relief-contact-link" title="Call representative">
                          <Phone size={11} />
                          <span>{request.representativePhone}</span>
                        </a>
                      )}
                      {request.representativeEmail && (
                        <a href={`mailto:${request.representativeEmail}`} className="relief-contact-link" title="Email representative">
                          <Mail size={11} />
                          <span>{request.representativeEmail}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="relief-barangay-bottom-row">
                  <span className="relief-history-stat">
                    <FileText size={12} />
                    <span><strong>{prevRequestsCount}</strong> previous requests</span>
                  </span>
                  <button 
                    type="button"
                    className="relief-view-barangay-btn"
                    onClick={() => {
                      onClose();
                      navigate(`/admin/beneficiaries/${request.beneficiaryId}`);
                    }}
                    title="Open barangay history"
                  >
                    <span>View Profile</span>
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>

              {/* Administrative Remarks Card */}
              <div className="relief-card relief-notes-card">
                <div className="relief-notes-header">
                  <div className="relief-section-label">
                    <span>Administrative Remarks</span>
                    <span className="editable-hint">(Editable)</span>
                  </div>
                  {isNotesDirty && (
                    <button 
                      type="button" 
                      className="relief-save-notes-mini-btn" 
                      onClick={handleSaveNotesOnly}
                      disabled={isUpdating}
                    >
                      <Check size={11} strokeWidth={2.5} /> Save Notes
                    </button>
                  )}
                </div>

                {/* Quick note helpers */}
                <div className="relief-quick-tags">
                  {['Verified with captain', 'Immediate dispatch', 'Awaiting truck', 'Partial stock'].map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="relief-quick-tag-btn"
                      onClick={() => {
                        setNotes(prev => prev ? `${prev.trim()}\n• ${tag}` : `• ${tag}`);
                      }}
                      title={`Append "${tag}" to remarks`}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>

                <textarea 
                  className="relief-notes-textarea"
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Enter administrative notes, delivery instructions, or remarks..."
                />
              </div>

            </div>
          </div>
        </div>

        {/* Modal Footer / Secondary Actions (Fixed at bottom) */}
        <div className="relief-review-footer">
          <div className="relief-review-footer-left">
            <button 
              type="button" 
              className="btn btn--outline btn--sm" 
              onClick={onClose}
            >
              Close
            </button>
          </div>
          {isNotesDirty && (
            <div style={{ fontSize: '0.78rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={12} />
              <span>Unsaved remarks changes</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

