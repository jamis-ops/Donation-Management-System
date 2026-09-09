# System Audit & Production Pre-Deployment Analysis Report
**Organization:** Rise Above Foundation Cebu  
**Project:** Donation & Relief Management System  
**Audit Date:** 2026-09-08  
**Author:** Senior Full-Stack Deployment Engineer  

---

## 1. Current Architecture Overview

```
                                    ┌────────────────────────────────────────────────────────┐
                                    │                     CLIENT TIER                        │
                                    │               React 18/19 + Vite (SPA)                 │
                                    │   Role Portals: Super Admin, Admin, Staff,             │
                                    │                 Barangay, Volunteer, Donor, Public     │
                                    └──────────────────────────┬─────────────────────────────┘
                                                               │  HTTPS / JSON / Cookies
                                                               │  (credentials: 'include')
                                                               ▼
                                    ┌────────────────────────────────────────────────────────┐
                                    │                     API GATEWAY                        │
                                    │               PHP 8.2 + Apache REST API                │
                                    │             (Backend/api/*.php endpoints)              │
                                    └──────┬───────────────────┼────────────────────┬────────┘
                                           │                   │                    │
                     ┌─────────────────────┴──────┐ ┌──────────┴──────────┐ ┌───────┴───────────────┐
                     │       DATABASE TIER        │ │     AI ENGINE       │ │     EMAIL ENGINE      │
                     │  MySQL / TiDB-Compatible   │ │  Google Gemini API  │ │   Direct Brevo API    │
                     │    (PDO with SSL/TLS)      │ │   (PHP cURL Server) │ │   (Migrated from Node)│
                     └────────────────────────────┘ └─────────────────────┘ └───────────────────────┘
```

| Component | Current Local Setup | Target Production Setup | Status / Gap |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 19 + Vite 8 on `localhost:5173` | **Vercel** | Vite proxy to `localhost:8000` must be replaced by `VITE_API_URL` runtime environment variable; SPA rewrites needed for deep routing. |
| **Backend** | PHP 8.2 built-in server on `localhost:8000` | **Render (Docker / Apache)** | Needs Dockerfile with PHP 8.2 + Apache + `pdo_mysql` + `mod_rewrite` + `.htaccess` routing + `/api/health` check. |
| **Database** | Local MySQL (port 3306, user `root`, no password) | **TiDB Cloud (MySQL 8.0 compatible)** | Needs consolidated, production-tested `database/donation_system.sql` + PDO SSL/TLS connection handling + environment variable loading. |
| **Email** | Node.js Express + Nodemailer microservice (`localhost:8025`) | **Brevo REST API directly in PHP** | Need reusable PHP Brevo API client (`mailer.php`), eliminating Node.js server overhead and local SMTP dependencies. |
| **AI Matching** | Google Gemini API via PHP cURL in `volunteer_ai_match.php` | **Google Gemini API via Backend** | Backend-only (`GEMINI_API_KEY`), keys never sent to frontend. |
| **Authentication** | PHP Session (`PHPSESSID`) with `SameSite=Lax` | **Cross-Site PHP Session (`SameSite=None; Secure`)** | Cross-domain auth between `*.vercel.app` and `*.onrender.com` requires `SameSite=None; Secure` cookie params. |
| **File Gate** | Local filesystem (`Backend/api/uploads/`) & `file.php` | **Persistent / File Gate** | Sensitive proofs gated through `file.php`; Frontend image/proof rendering requires base URL awareness. |

---

## 2. Current Folder Structure

```
c:\Users\James\DonationSystem/
├── Frontend/                          # React + Vite Frontend
│   ├── public/                        # Static assets
│   ├── src/
│   │   ├── admin/                     # Admin & Super Admin portal views & components
│   │   ├── api/
│   │   │   ├── auth.js                # Auth endpoints (login, logout, me, register)
│   │   │   └── resources.js           # Resource API clients (donations, inventory, etc.)
│   │   ├── auth/                      # Login, password change, invite acceptance pages
│   │   ├── context/                   # AuthContext, ToastContext, ConfirmContext, LoadingContext
│   │   ├── portals/                   # Role-specific portals (donor, volunteer, beneficiary, staff)
│   │   ├── public/                    # Public-facing landing pages (Home, Donate, Volunteer, etc.)
│   │   ├── App.jsx                    # React Router configuration
│   │   ├── main.jsx                   # React root mount
│   │   └── index.css                  # Global styling
│   ├── package.json                   # Frontend dependencies
│   └── vite.config.js                 # Vite dev proxy configuration
│
├── Backend/                           # PHP 8.2 REST API
│   ├── api/
│   │   ├── account.php                # Profile & password updates
│   │   ├── admin_badges.php           # Admin section view tracking & unread badge counters
│   │   ├── allocations.php            # Resource allocation logic & priority validation
│   │   ├── app_url.php                # URL resolution helpers (frontend vs backend)
│   │   ├── assistance_requests.php    # Relief requests, SLA calculations, duplicate checks
│   │   ├── beneficiaries.php          # Barangay management, invites, partnership workflows
│   │   ├── bootstrap.php              # Core middleware, auth guard, role checks, helpers
│   │   ├── catalog_items.php          # Admin-managed setting catalogs
│   │   ├── certificates.php           # Certificate generation & issuance
│   │   ├── config.php                 # Database connection & global settings
│   │   ├── contact.php                # Public contact form submissions
│   │   ├── content.php                # CMS endpoints (programs, announcements, partners)
│   │   ├── cors.php                   # Cross-Origin Resource Sharing middleware
│   │   ├── dashboard.php              # Metrics and aggregation for admin dashboard
│   │   ├── database_management.php    # Super Admin database inspection & maintenance
│   │   ├── distribution_proofs.php    # Uploaded photo & document proofs of distribution
│   │   ├── distributions.php          # Relief dispatch & receipt tracking
│   │   ├── donation_updates.php       # Donation progress timeline tracking
│   │   ├── donations.php              # Donation intake, verification, receipt proofs
│   │   ├── donors.php                 # Donor profile management
│   │   ├── file.php                   # Authenticated secure file gate for sensitive uploads
│   │   ├── inventory.php              # Stock levels, adjustments, multi-source repacking
│   │   ├── login.php                  # Authentication & session creation
│   │   ├── logout.php                 # Session destruction & cookie invalidation
│   │   ├── mail_config.php            # Email configuration (git-ignored)
│   │   ├── mail_config.sample.php     # Sample email config template
│   │   ├── mailer.php                 # Email dispatch service & transactional templates
│   │   ├── me.php                     # Current authenticated session endpoint
│   │   ├── migrate.php / migrate.sql  # Database migrations
│   │   ├── migrate_multi_source_repacking.sql # Multi-source repacking batch schema & views
│   │   ├── notifications.php          # In-app notification system
│   │   ├── portal.php                 # Unified role portal metrics endpoint
│   │   ├── reports.php                # Exportable summaries & statistics
│   │   ├── schema.sql                 # Baseline MySQL schema
│   │   ├── seed.php                   # Database seeder
│   │   ├── setup.php                  # Initial setup script
│   │   ├── signup.php                 # User registration
│   │   ├── staff.php                  # Staff management
│   │   ├── super_admin.php            # Super Admin configuration & credentials guard
│   │   ├── tasks.php                  # Volunteer task management & board columns
│   │   ├── verify.php                 # Email verification endpoint
│   │   ├── volunteer_ai_match.php     # Gemini AI CV parsing & program matching
│   │   ├── volunteer_match.php        # Algorithmic volunteer matching
│   │   ├── volunteers.php             # Volunteer roster, hours, resumes
│   │   └── uploads/                   # Uploaded proofs, profiles, resumes (.htaccess protected)
│   ├── mail-service/                  # Legacy Node.js/Nodemailer microservice (to be superseded by Brevo)
│   ├── scripts/                       # Local PowerShell dev start scripts
│   ├── .env                           # Local environment file
│   └── .env.example                   # Local env template
├── package.json                       # Root script convenience shortcuts
└── README.md
```

---

## 3. Problems That Will Prevent Production Deployment

1. **Hardcoded Local Database Settings & Missing SSL in `config.php`**:
   - `Backend/api/config.php` has hardcoded `$DB_HOST = '127.0.0.1'`, `$DB_USER = 'root'`, `$DB_PASS = ''`.
   - TiDB Cloud runs over port `4000`, requires a specific TLS connection (`PDO::MYSQL_ATTR_SSL_CA` or system trust certificates), and uses environment variables.
2. **Missing Cross-Site Cookie Configuration for Render + Vercel**:
   - Because the frontend (`https://xxx.vercel.app`) and backend (`https://yyy.onrender.com`) are on different domains, PHP's default session cookie setting (`SameSite=Lax`, `Secure=false`) will cause browsers to **drop the session cookie on every request**, breaking login.
   - When running on HTTPS in production, `session_set_cookie_params()` must set `'samesite' => 'None'` and `'secure' => true`.
3. **Hardcoded API Proxies in Frontend**:
   - `Frontend/src/api/resources.js` and `Frontend/src/api/auth.js` use relative `/api/...` paths relying on Vite's local proxy.
   - On Vercel, requests to `/api/...` will fail unless configured with a single source of truth: `import.meta.env.VITE_API_URL`.
4. **Vercel SPA 404 Routing on Deep Links**:
   - The frontend uses React Router (`createBrowserRouter`). Refreshing on `/admin/dashboard`, `/donor/donations`, or `/accept-invite/:token` on Vercel will return `404 Not Found` without a `vercel.json` rewrite to `/index.html`.
5. **Apache Route Rewriting on Render**:
   - Render's Apache web server needs an `.htaccess` rule so that incoming requests to `/api/login.php` or `/login.php` correctly resolve regardless of how the URL is constructed.
6. **Email System Dependency on Local Node Service**:
   - Currently, `mailer.php` delegates email sending to `http://127.0.0.1:8025` (Node.js mail service).
   - In production on Render, maintaining two separate servers (PHP and Node.js) adds unnecessary overhead and failure points. Direct Brevo API integration in PHP provides a lightweight, resilient solution.
7. **Database Schema Fragmentation**:
   - The database schema is split across `schema.sql`, `migrate.sql`, `migrate_v2.sql`, and `migrate_multi_source_repacking.sql`.
   - TiDB Cloud needs a single, unified, clean `database/donation_system.sql` file that executes without syntax errors.

---

## 4. Required Changes

### A. Environment Configuration
- Support reading variables from both server environment (`getenv()`, `$_ENV`) and local `.env` files.
- Provide clean `.env.example` templates for both Backend and Frontend.
- Protect all secrets from being exposed to the frontend or committed to git.

### B. Database / TiDB Cloud Compatibility
- Upgrade `db()` PDO factory in `Backend/api/config.php` to dynamically read `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (or `DB_PASS`), and configure SSL options for TiDB Cloud.
- Assemble a clean, unified `database/donation_system.sql` schema file compatible with TiDB Cloud (InnoDB, utf8mb4, valid foreign keys and indexes).

### C. Backend & Render Containerization
- Provide a production-grade `Dockerfile` using `php:8.2-apache` with `pdo_mysql`, `curl`, `mbstring`, and Apache `mod_rewrite` enabled.
- Add an Apache `.htaccess` file supporting both direct script routing and `/api/...` prefixed requests.
- Add a lightweight, secure health check endpoint (`/api/health.php` or route) returning `{"status": "ok"}`.

### D. Cross-Origin Resource Sharing (CORS) & Auth Cookies
- Update `cors.php` to read `FRONTEND_URL` and allow credentials safely.
- Update `login.php`, `bootstrap.php`, and `me.php` to configure `SameSite=None; Secure` cookies when running on HTTPS or when `FRONTEND_URL` is configured.

### E. Direct Brevo Email Integration
- Implement direct Brevo REST API v3 sending in `Backend/api/mailer.php` using `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, and `MAIL_FROM_NAME`.
- Retain existing email templates (welcome credentials, password changes, email verification, barangay invitations, certificate readiness, distribution receipts) without breaking local fallback.

### F. Frontend & Vercel Deployment
- Update `Frontend/src/api/resources.js` and `Frontend/src/api/auth.js` to use `VITE_API_URL`.
- Add `resolveMediaUrl` / `apiUrl` helpers so images, proofs, and downloads resolve properly across domains.
- Add `Frontend/vercel.json` with SPA rewrite rules for client-side routing.

---

## 5. Files Requiring Modification vs Files to Protect

### Files to Modify / Create
| Path | Action | Purpose |
| :--- | :--- | :--- |
| `Backend/api/config.php` | Modify | Load environment variables, handle TiDB Cloud SSL connection and port |
| `Backend/api/cors.php` | Modify | Support production `FRONTEND_URL` while preserving local Vite dev ports |
| `Backend/api/login.php` | Modify | Enable `SameSite=None; Secure` session cookies on HTTPS for cross-site auth |
| `Backend/api/bootstrap.php` | Modify | Ensure consistent cross-site session cookie parameters across all endpoints |
| `Backend/api/mailer.php` | Modify | Add direct Brevo REST API v3 integration with existing transactional templates |
| `Backend/api/health.php` | Create | Simple, secure health check endpoint for Render (`GET /api/health.php`) |
| `Backend/.htaccess` | Create | Apache rewrite rules for clean `/api/*` and `.php` routing |
| `Backend/Dockerfile` | Create | Production container definition for PHP 8.2 + Apache on Render |
| `database/donation_system.sql` | Create | Consolidated, clean SQL schema for TiDB Cloud import |
| `Frontend/src/api/resources.js` | Modify | Support `VITE_API_URL` and URL normalization for API and media requests |
| `Frontend/src/api/auth.js` | Modify | Support `VITE_API_URL` for auth requests |
| `Frontend/vercel.json` | Create | SPA rewrite rules for Vercel routing |
| `.gitignore` | Modify | Ensure `.env`, uploads, and secrets are excluded from version control |
| `Backend/.env.example` | Create/Update | Document all backend production variables with clean placeholders |
| `Frontend/.env.example` | Create | Document `VITE_API_URL` placeholder |

### Files That Must NOT Be Modified (Business Logic Intact)
- `Backend/api/assistance_requests.php` (business priority rules, SLA logic, duplicate checking must remain intact)
- `Backend/api/super_admin.php` (Super Admin synthetic auth and permissions logic must remain protected)
- `Backend/api/database_management.php` (strict Super Admin access guards must remain preserved)
- `Backend/api/volunteer_ai_match.php` (Gemini AI prompt, scoring logic, and parsing routines)
- `Frontend/src/admin/pages/*` & `Frontend/src/portals/*` (UI views, role-based workflows, and forms)

---

## 6. Environment Variables Summary

### Backend (`Backend/.env` & Render Dashboard)
| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `DB_HOST` | TiDB Cloud Gateway Host | `gateway01.ap-southeast-1.prod.aws.tidbcloud.com` |
| `DB_PORT` | TiDB Cloud Port | `4000` |
| `DB_NAME` | Database Name | `donation_system` |
| `DB_USER` | TiDB Cloud Username | `xxxxxx.root` |
| `DB_PASSWORD` | TiDB Cloud Password | `your-tidb-password` |
| `DB_SSL` | Enable SSL for TiDB Cloud | `true` |
| `FRONTEND_URL` | Deployed Vercel Frontend URL | `https://donation-system.vercel.app` |
| `GEMINI_API_KEY` | Google AI Studio Key | `AIzaSy...` |
| `BREVO_API_KEY` | Brevo v3 REST API Key | `xkeysib-...` |
| `MAIL_FROM_EMAIL`| Verified Sender Email in Brevo | `contact@riseabovefoundation.org` |
| `MAIL_FROM_NAME` | Sender Display Name | `Rise Above Foundation Cebu` |
| `SUPER_ADMIN_EMAIL` | Super Admin Email (Optional Override) | `superadmin@riseabovefoundation.org` |

### Frontend (`Frontend/.env` & Vercel Dashboard)
| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | Render Backend Base URL | `https://donation-backend.onrender.com` |

---

## 7. Potential Production Risks & Mitigations

1. **Third-Party Cookie / Cross-Site Session Blocking**:
   - *Risk*: Browsers blocking cross-site session cookies between Vercel and Render.
   - *Mitigation*: Backend will set `SameSite=None; Secure` on all session cookies when accessed over HTTPS.
2. **Render Ephemeral Filesystem**:
   - *Risk*: Proof images uploaded to local disk disappear if Render spins down or restarts.
   - *Mitigation*: The authenticated `file.php` gate will continue to handle local storage gracefully, and the application architecture will remain modular so Cloudinary or S3 storage can be plugged in seamlessly without breaking endpoints.
3. **Render Free-Tier Spin Down Delay**:
   - *Risk*: Cold starts on free tier taking 30-50 seconds.
   - *Mitigation*: Health check endpoint and friendly frontend timeout / retry messaging.
4. **TiDB Cloud TLS Certificate Trust**:
   - *Risk*: PHP PDO failing SSL handshake if system CA certificates are not configured in Docker.
   - *Mitigation*: The Dockerfile will install `ca-certificates` and PHP's PDO MySQL driver will be configured to establish TLS connections smoothly.

---

## 8. Implementation Phases & Roadmap

- **Phase 1**: System Audit & Pre-Deployment Analysis (*Completed*)
- **Phase 2**: Environment Configuration & Git Protection
- **Phase 3**: Consolidated Database Preparation (`database/donation_system.sql`) & TiDB Cloud Compatibility
- **Phase 4**: PHP Backend Containerization (Dockerfile, Apache `.htaccess`, Health Check)
- **Phase 5**: Brevo Email System Integration
- **Phase 6**: Frontend Preparation for Vercel (`VITE_API_URL` & `vercel.json`)
- **Phase 7**: Local Production Verification & Build Tests
- **Phase 8**: Final Step-by-Step Hosting Deployment Guide (TiDB Cloud, Render, Brevo, Vercel)
