import os
import subprocess
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'''<w:tcMar {nsdecls("w")}>
        <w:top w:w="{top}" w:type="dxa"/>
        <w:bottom w:w="{bottom}" w:type="dxa"/>
        <w:left w:w="{left}" w:type="dxa"/>
        <w:right w:w="{right}" w:type="dxa"/>
    </w:tcMar>''')
    tcPr.append(tcMar)

def set_table_borders(table, color="D3D3D3"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''<w:tblBorders {nsdecls("w")}>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="{color}"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="{color}"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="{color}"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="{color}"/>
        <w:left w:val="none"/>
        <w:right w:val="none"/>
    </w:tblBorders>''')
    tblPr.append(borders)

def create_styled_table(doc, headers, data, col_widths=None):
    table = doc.add_table(rows=len(data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table, "B0C4DE")

    # Header Row
    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = title
        set_cell_background(hdr_cells[i], "1F497D")  # Dark Navy Blue as in screenshot
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=150, right=150)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in p.runs:
            run.font.name = 'Calibri'
            run.font.size = Pt(10)
            run.font.bold = True
            run.font.color.rgb = RGBColor(255, 255, 255)

    # Data Rows
    for r_idx, row in enumerate(data):
        row_cells = table.rows[r_idx + 1].cells
        bg_color = "F7F9FC" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row):
            row_cells[c_idx].text = val
            set_cell_background(row_cells[c_idx], bg_color)
            set_cell_margins(row_cells[c_idx], top=100, bottom=100, left=150, right=150)
            p = row_cells[c_idx].paragraphs[0]
            for run in p.runs:
                run.font.name = 'Calibri'
                run.font.size = Pt(9.5)
                run.font.color.rgb = RGBColor(30, 30, 30)

    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Inches(w)

    doc.add_paragraph() # Spacing
    return table

def add_heading_1(doc, text):
    h = doc.add_heading(text, level=1)
    h.paragraph_format.space_before = Pt(16)
    h.paragraph_format.space_after = Pt(6)
    for run in h.runs:
        run.font.name = 'Calibri'
        run.font.size = Pt(16)
        run.font.bold = True
        run.font.color.rgb = RGBColor(31, 73, 125)
    return h

def add_heading_2(doc, text):
    h = doc.add_heading(text, level=2)
    h.paragraph_format.space_before = Pt(12)
    h.paragraph_format.space_after = Pt(4)
    for run in h.runs:
        run.font.name = 'Calibri'
        run.font.size = Pt(13)
        run.font.bold = True
        run.font.color.rgb = RGBColor(46, 117, 182)
    return h

def add_heading_3(doc, text):
    h = doc.add_heading(text, level=3)
    h.paragraph_format.space_before = Pt(8)
    h.paragraph_format.space_after = Pt(2)
    for run in h.runs:
        run.font.name = 'Calibri'
        run.font.size = Pt(11)
        run.font.bold = True
        run.font.color.rgb = RGBColor(60, 60, 60)
    return h

def add_paragraph(doc, text, bold_prefix=None, italic=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.name = 'Calibri'
        r_pre.font.size = Pt(10.5)
        r_pre.font.bold = True
        r_pre.font.color.rgb = RGBColor(30, 30, 30)
    r = p.add_run(text)
    r.font.name = 'Calibri'
    r.font.size = Pt(10.5)
    r.font.italic = italic
    r.font.color.rgb = RGBColor(40, 40, 40)
    return p

def add_bullet(doc, text, bold_prefix=None):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    if bold_prefix:
        r_pre = p.add_run(bold_prefix)
        r_pre.font.name = 'Calibri'
        r_pre.font.size = Pt(10.5)
        r_pre.font.bold = True
        r_pre.font.color.rgb = RGBColor(30, 30, 30)
    r = p.add_run(text)
    r.font.name = 'Calibri'
    r.font.size = Pt(10.5)
    r.font.color.rgb = RGBColor(40, 40, 40)
    return p

def add_callout(doc, title, content):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    set_cell_background(cell, "F0F4F8")
    set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'''<w:tcBorders {nsdecls("w")}>
        <w:left w:val="single" w:sz="24" w:space="0" w:color="1F497D"/>
        <w:top w:val="none"/>
        <w:bottom w:val="none"/>
        <w:right w:val="none"/>
    </w:tcBorders>''')
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(4)
    r1 = p.add_run(title + "\n")
    r1.font.name = 'Calibri'
    r1.font.size = Pt(10.5)
    r1.font.bold = True
    r1.font.color.rgb = RGBColor(31, 73, 125)
    
    r2 = p.add_run(content)
    r2.font.name = 'Calibri'
    r2.font.size = Pt(9.5)
    r2.font.color.rgb = RGBColor(60, 60, 60)
    
    doc.add_paragraph()

print("Generating Document...")
doc = Document()

# Set standard 1-inch margins
sections = doc.sections
for section in sections:
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)

# Document Header / Metadata Banner
add_callout(doc, 
    "SWU 003 — Final Project System Design & Governance Document", 
    "Project: Optimizing Resource Allocation in Disaster Relief Operations Through Web-Based Donation System\n"
    "Organization: Rise Above Foundation Cebu | Southwestern University PHINMA\n"
    "Team Members: Julie Anne Utrera, Aubrie Marie Dual, Sheena Marie Dinaguit, James Lloyd Isidro\n"
    "Sections Included: 3.5 Database Metadata, 3.6 Environments, 3.7 Service Accounts, and 4.2.2 - 4.2.7 Governance Standards")

# ==============================================================================
# SECTION 3.5
# ==============================================================================
add_heading_1(doc, "3.5. Database Metadata")
add_paragraph(doc, 
    "The system utilizes a relational database management system hosted on TiDB Cloud (Serverless MySQL 8.0 compatible engine) "
    "operating with utf8mb4 character set and utf8mb4_general_ci collation. The complete schema comprises twenty-seven (27) "
    "normalized tables structured across user role-based access control, donation lifecycles, relief inventory tracking, "
    "kit repacking operations, calamity distribution logistics, volunteer shift scheduling, and cryptographically verifiable digital certificates.")

add_callout(doc, "Database Metadata Link & Separate File Specification:",
    "GitHub Repository Database Schema Link:\n"
    "https://github.com/jamis-ops/Donation-Management-System/blob/main/database/donation_system.sql\n\n"
    "Complete Data Dictionary & Metadata Documentation Link:\n"
    "https://github.com/jamis-ops/Donation-Management-System/blob/main/database/DATABASE_METADATA.md")

add_paragraph(doc, "Summary of Database Tables & Entity Relationships:", bold_prefix="Table Summary: ")

db_headers = ["Module", "Table Name", "Primary Key", "Engine", "Description & Purpose"]
db_data = [
    ["Authentication & RBAC", "roles", "id (INT)", "InnoDB", "Defines system privilege tiers (Admin, Staff, Donor, Volunteer, Beneficiary)."],
    ["Authentication & RBAC", "users", "id (BIGINT)", "InnoDB", "Central user identities, encrypted bcrypt password hashes, status, and audit logs."],
    ["Authentication & RBAC", "password_resets", "id (BIGINT)", "InnoDB", "Time-limited 6-digit recovery codes, temp tokens, and brute-force counters."],
    ["Donations", "donors", "id (BIGINT)", "InnoDB", "Individual and corporate donor profiles, unique donor codes, and organization links."],
    ["Donations", "donations", "id (BIGINT)", "InnoDB", "Monetary and in-kind donation ledgers, public tracking codes, payment proofs, statuses."],
    ["Donations", "donation_updates", "id (BIGINT)", "InnoDB", "Real-time timeline audit trail (Received, Inspected, Allocated, Dispatched)."],
    ["Donations", "donation_procurements", "id (BIGINT)", "InnoDB", "Direct allocations linking monetary funds to specific relief item purchases."],
    ["Beneficiaries", "beneficiaries", "id (BIGINT)", "InnoDB", "Barangay units, evacuation centers, family head profiles, and vulnerability scores."],
    ["Beneficiaries", "need_types", "id (INT)", "InnoDB", "Configurable lookup catalog of assistance requirements."],
    ["Beneficiaries", "barangay_types", "id (INT)", "InnoDB", "Categorization of barangay jurisdictions across Cebu."],
    ["Beneficiaries", "assistance_requests", "id (BIGINT)", "InnoDB", "Formal calamity assistance requests with urgency ratings and status tracking."],
    ["Inventory & Repacking", "inventory_items", "id (BIGINT)", "InnoDB", "Warehouse relief stock, quantities on hand, reorder thresholds, and expiration dates."],
    ["Inventory & Repacking", "repacking_jobs", "id (BIGINT)", "InnoDB", "Work orders bundling individual stock into standardized family food packs."],
    ["Distribution", "distributions", "id (BIGINT)", "InnoDB", "Disaster relief missions, barangay venues, dispatch logs, and completion verification."],
    ["Distribution", "allocations", "id (BIGINT)", "InnoDB", "Linkage between assembled relief packs and specific distribution batches."],
    ["Distribution", "distribution_proofs", "id (BIGINT)", "InnoDB", "Field-uploaded photo evidence, delivery manifests, and beneficiary sign-offs."],
    ["Volunteers & Operations", "volunteers", "id (BIGINT)", "InnoDB", "Volunteer profiles, logged duty hours, skills, and Google Gemini AI CV summaries."],
    ["Volunteers & Operations", "volunteer_schedule", "id (BIGINT)", "InnoDB", "Duty shifts, calendar schedules, and operational assignments."],
    ["Volunteers & Operations", "tasks", "id (BIGINT)", "InnoDB", "Operational task dispatch board with statuses and assigned volunteer IDs."],
    ["Volunteers & Operations", "task_types", "id (INT)", "InnoDB", "Lookup categorization of operational relief duties."],
    ["Certificates & Engagement", "certificates", "id (BIGINT)", "InnoDB", "Verifiable digital certificates with unique hash codes and public QR validation."],
    ["Certificates & Engagement", "programs", "id (BIGINT)", "InnoDB", "Community outreach initiatives and disaster preparation programs."],
    ["Certificates & Engagement", "announcements", "id (BIGINT)", "InnoDB", "Public bulletins, relief operation updates, and disaster advisories."],
    ["Certificates & Engagement", "partners", "id (BIGINT)", "InnoDB", "Collaborating NGOs, corporate sponsors, and government LGU partners."],
    ["Certificates & Engagement", "success_stories", "id (BIGINT)", "InnoDB", "Published community impact stories and relief distribution transparency logs."],
    ["Certificates & Engagement", "notifications", "id (BIGINT)", "InnoDB", "Transactional system alerts delivered to user dashboards."],
    ["Certificates & Engagement", "admin_section_views", "id (BIGINT)", "InnoDB", "Tracks administrative read/audit states across sub-sections."]
]
create_styled_table(doc, db_headers, db_data, [1.4, 1.4, 1.0, 0.8, 2.4])

# ==============================================================================
# SECTION 3.6
# ==============================================================================
add_heading_1(doc, "3.6. Environments")
add_paragraph(doc, 
    "To ensure system availability, data integrity, and strict isolation between development, verification, and live disaster relief operations, "
    "the system is segregated into three distinct execution tiers: Production, User Acceptance Testing (UAT), and Test (Development).")

add_heading_2(doc, "For the System (Frontend Web Application):")
env_system_headers = ["Production", "UAT", "Test"]
env_system_data = [
    [
        "https://donation-system-frontend.vercel.app\n(Primary Production SPA on Vercel CDN)",
        "https://donation-system-uat.vercel.app\n(Staging / UAT Environment for Rise Above coordinators)",
        "http://localhost:5173\n(Local Vite / React Development Server)"
    ]
]
create_styled_table(doc, env_system_headers, env_system_data, [2.3, 2.4, 2.3])

add_heading_2(doc, "For the API (Backend RESTful Web Services):")
env_api_headers = ["Production", "UAT", "Test"]
env_api_data = [
    [
        "https://donation-system-api.onrender.com/api\n(Dockerized PHP 8.2 on Render Cloud, SG Region)",
        "https://donation-system-api-uat.onrender.com/api\n(UAT Staging API Instance on Render)",
        "http://localhost:8000/api\n(Local PHP Built-in Server CLI)"
    ]
]
create_styled_table(doc, env_api_headers, env_api_data, [2.3, 2.4, 2.3])

add_heading_2(doc, "For the Database (MySQL 8.0 / TiDB Cloud Serverless):")
env_db_headers = ["Production", "UAT", "Test"]
env_db_data = [
    [
        "gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000\nDatabase: donation_system\n(TLS/SSL Encrypted Serverless Cluster)",
        "gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000\nDatabase: donation_system_uat\n(Isolated UAT Staging Branch)",
        "127.0.0.1:3306 / local_test.sqlite\nDatabase: donation_system_test\n(Local SQLite / MySQL Dev Instance)"
    ]
]
create_styled_table(doc, env_db_headers, env_db_data, [2.3, 2.4, 2.3])

# ==============================================================================
# SECTION 3.7
# ==============================================================================
add_heading_1(doc, "3.7. Service Accounts")
add_paragraph(doc, 
    "Service accounts provide programmatic and non-interactive authentication for automated platform operations, including "
    "transactional email dispatches (Brevo API), AI skill recommendation pipelines (Google Gemini AI), automated database migrations, "
    "and system administration roles.")

add_heading_2(doc, "For the System:")
svc_headers = ["Production", "UAT", "Test"]
svc_data = [
    [
        "Primary Super Admin Account:\nadmin@riseabovefoundation.org\n\nAutomated System Notification Sender:\nnoreply@riseabovefoundation.org\n\nCloud Infrastructure / CI/CD:\ndevops@riseabovefoundation.org",
        "UAT Lead Admin Account:\nuat-admin@riseabovefoundation.org\n\nUAT Notification Mailer:\nuat-mailer@riseabovefoundation.org\n\nUAT Testing Lead Coordinator:\nuat-tester@riseabovefoundation.org",
        "Local Test Admin Account:\ntest-admin@localhost.dev\n\nLocal Mock Notification Service:\nmailhog@localhost.dev\n\nCapstone Lead Developer Contact:\njamesisidro0808@gmail.com"
    ]
]
create_styled_table(doc, svc_headers, svc_data, [2.3, 2.4, 2.3])

# ==============================================================================
# SECTION 4.2 GOVERNANCE
# ==============================================================================
add_heading_1(doc, "4.2. Governance Standards")

# 4.2.2 Code Naming Convention
add_heading_2(doc, "4.2.2. Code Naming Convention")
add_paragraph(doc, 
    "Purpose: The establishment of uniform code naming conventions ensures maintainability, seamless readability, and "
    "cross-stack consistency across a heterogeneous architecture combining a modern React 18/19 JavaScript Single Page Application (SPA), "
    "a PHP 8.2 RESTful backend API, and a relational MySQL/TiDB database.",
    bold_prefix="Purpose: ")

add_paragraph(doc, "Specific Casing Styles and Scopes:", bold_prefix="Casing Standards: ")
add_bullet(doc, "PascalCase: Applied to React UI Components (e.g., StatsSection.jsx, PartnersSection.jsx, AdminLayout.jsx), Context Providers (AuthContext.jsx, ThemeContext.jsx), and PHP Object-Oriented Classes/Exceptions.", bold_prefix="PascalCase: ")
add_bullet(doc, "camelCase: Applied to JavaScript variables, React custom hooks (e.g., useApiList, usePagination, useAuth), component props, JavaScript helper functions (e.g., fetchDonationStats(), handleVerify()), and JSON API request/response properties.", bold_prefix="camelCase: ")
add_bullet(doc, "snake_case: Applied to all database tables and column identifiers (e.g., inventory_items, tracking_code, proof_file, created_at) and PHP backend script variables, database parameters, and procedural functions (e.g., $db_host, get_db_connection()).", bold_prefix="snake_case: ")
add_bullet(doc, "UPPER_SNAKE_CASE: Strictly enforced for global constants, configuration definitions, and environment variables (e.g., DB_HOST, DB_PASSWORD, JWT_SECRET, VITE_API_URL, MAX_UPLOAD_FILE_SIZE_MB).", bold_prefix="UPPER_SNAKE_CASE: ")
add_bullet(doc, "kebab-case: Applied to CSS class names (e.g., .stat-card, .btn-primary, .modal-backdrop), URL web route paths (e.g., /admin/inventory-management, /portals/donor/certificates), and REST API endpoint URLs (e.g., /api/donation-updates.php).", bold_prefix="kebab-case: ")

add_paragraph(doc, "Prefixes and Suffixes Requirements:", bold_prefix="Prefixes & Suffixes: ")
add_bullet(doc, "Boolean Variables & Flags: Must be prefixed with affirmative state verbs such as is, has, can, or should (e.g., isLoading, isVerified, hasPermission, canDistribute, shouldNotify).", bold_prefix="Booleans: ")
add_bullet(doc, "React Custom Hooks: Must invariably begin with the 'use' prefix in compliance with React Hook specifications (e.g., useApiList, usePagination, useAuth).", bold_prefix="Hooks: ")
add_bullet(doc, "Event Handler Functions: Must begin with 'handle' for definition (e.g., handleDonationSubmit, handleStatusChange) or 'on' for assigned component callback props (e.g., onSubmit, onStatusChange).", bold_prefix="Event Handlers: ")
add_bullet(doc, "Database Foreign Keys: Must always be suffixed with '_id' matching the singular referenced table name (e.g., user_id, donor_id, distribution_id, role_id).", bold_prefix="Foreign Keys: ")

add_paragraph(doc, "Rules for Abbreviations: Cryptic abbreviations are strictly forbidden. Standard, universally recognized domain abbreviations are permitted: id (Identifier), db (Database), api (Application Programming Interface), url (Uniform Resource Locator), cv (Curriculum Vitae), auth (Authentication), lgu (Local Government Unit). Full descriptive names must be used for business domain models (e.g., use beneficiary instead of ben, and repacking_job instead of rpk_j).", bold_prefix="Abbreviations: ")
add_paragraph(doc, "Exceptions: Environmental credentials and hard constants are represented exclusively in ALL_CAPS. Acronyms embedded within camelCase identifiers maintain unified capitalization (e.g., parseCsvFile, fetchApiData).", bold_prefix="Exceptions: ")

# 4.2.3 Coding Standards
add_heading_2(doc, "4.2.3. Coding Standards")
add_paragraph(doc, 
    "Overall Coding Philosophy: The development team adheres to core software engineering methodologies: "
    "1) DRY (Don't Repeat Yourself) — common database routines, authentication filters, and UI notification modals are centralized into reusable modules; "
    "2) SOLID Principles — especially Single Responsibility for API endpoints and Open/Closed for relief status workflows; "
    "3) KISS (Keep It Simple, Stupid) — avoiding speculative over-engineering in favor of robust, transparent logic; and "
    "4) Defensive Programming — rigorous server-side input validation, strict parameter type-casting, and prepared SQL statements to block SQL injection and Cross-Site Scripting (XSS).",
    bold_prefix="Philosophy: ")

add_paragraph(doc, "Language & Framework Style Guides:", bold_prefix="Style Guides Referenced: ")
add_bullet(doc, "Frontend (JavaScript / React): Airbnb JavaScript Style Guide and Official React.dev guidelines.", bold_prefix="JavaScript: ")
add_bullet(doc, "Backend (PHP): PSR-12 (Extended Coding Style Guide) and PSR-4 (Autoloading Standards) defined by PHP-FIG.", bold_prefix="PHP: ")
add_bullet(doc, "Database (SQL): SQL Style Guide (ISO/IEC 9075) with capitalized standard SQL keywords and lowercase table/column names.", bold_prefix="SQL: ")

add_paragraph(doc, "Formatting Rules: JavaScript and CSS use 2-space soft indentation; PHP backend uses 4-space indentation. Maximum line length is capped at 100 characters. One True Brace Style (1TBS) is applied across JavaScript; PSR-12 brace placement is followed in PHP (classes and methods open on next line; control structures open on same line). Semicolons are mandatory.", bold_prefix="Formatting: ")
add_paragraph(doc, "Commenting & Documentation Expectations: All exported functions, hooks, and endpoints must be documented using structured JSDoc (Frontend) or PHPDoc (Backend) indicating parameter data types, expected returns, and exceptions thrown. Inline comments must document architectural intent ('why') rather than self-evident code statements ('what').", bold_prefix="Documentation: ")

add_paragraph(doc, "Error Handling Conventions: All API responses conform to a unified JSON response schema:", bold_prefix="Error Handling: ")
add_callout(doc, "Standard JSON Response Schema:",
    "{\n"
    "  \"success\": true | false,\n"
    "  \"data\": { ... } | null,\n"
    "  \"message\": \"Descriptive operational message\",\n"
    "  \"error\": \"Standardized error code or null\"\n"
    "}\n\n"
    "Explicit HTTP status codes must be returned (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable Entity, 500 Internal Server Error). Database connection exceptions must be caught and logged server-side, never leaking database passwords or raw stack traces to the client.")

add_paragraph(doc, "Enforcement Tools: ESLint and Prettier for frontend formatting; PHP_CodeSniffer (phpcs) for backend PSR-12 compliance; Git pre-commit hooks configured via Husky to block non-compliant commits.", bold_prefix="Enforcement Tools: ")

# 4.2.4 Environment Variables Standards
add_heading_2(doc, "4.2.4. Environment Variables Standards")
add_paragraph(doc, 
    "Purpose: In strict conformance with the Twelve-Factor App methodology (Config III), all environment-specific configurations, "
    "cryptographic secrets, and third-party credentials are completely decoupled from application source code, preventing accidental "
    "credential leaks and allowing identical builds to run across Development, UAT, and Production.",
    bold_prefix="Purpose: ")

add_paragraph(doc, "Naming Conventions & Categories: All environment variables use strict UPPER_SNAKE_CASE prefixed by domain:", bold_prefix="Naming Conventions: ")
add_bullet(doc, "Database Credentials: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL.", bold_prefix="Database: ")
add_bullet(doc, "External API Services: BREVO_API_KEY, GEMINI_API_KEY, MAIL_FROM_EMAIL, MAIL_FROM_NAME.", bold_prefix="Integrations: ")
add_bullet(doc, "Frontend Environment: VITE_API_URL, VITE_APP_ENV, VITE_APP_VERSION.", bold_prefix="Frontend (Vite): ")
add_bullet(doc, "CORS & Security: FRONTEND_URL, SESSION_LIFETIME, APP_SECRET.", bold_prefix="Security: ")

add_paragraph(doc, "Storage & Locations: Locally, environment variables are loaded from an uncommitted .env file. In cloud environments, secrets are managed securely through the Render Environment Dashboard (Backend) and Vercel Project Settings (Frontend). A sanitized template file (.env.example) is committed to version control with descriptive placeholders.", bold_prefix="Storage: ")
add_paragraph(doc, "Hardcoding Policies: Never hardcode passwords, API keys, database URLs, or security secrets. Permissible hardcoded items are limited to non-sensitive defaults, such as default pagination size (10 items), UI label constants, and fixed navigation routes.", bold_prefix="Hardcoding Rules: ")
add_paragraph(doc, "Security Practices: .env and .env.local are permanently registered in .gitignore. Production secrets are restricted to designated system administrators. Secrets are rotated every 90 days or immediately upon team member offboarding.", bold_prefix="Security: ")

# 4.2.5 Folder Structure
add_heading_2(doc, "4.2.5. Folder Structure")
add_paragraph(doc, 
    "Organizing Principle: The repository employs a Layered, Decoupled Client-Server Modular Architecture. "
    "The codebase cleanly separates the user interface Single Page Application (/Frontend) from the stateless REST API (/Backend) "
    "and shared data migration assets (/database).",
    bold_prefix="Principle: ")

add_paragraph(doc, "Top-Level Structure & Sub-Folder Roles:", bold_prefix="Directory Map: ")

folder_headers = ["Directory Path", "Layer / Scope", "Architectural Responsibility"]
folder_data = [
    ["/Backend/api/", "Backend API", "PHP RESTful API endpoints (donations, inventory, distributions, auth), session handling, and CORS middleware."],
    ["/Backend/api/uploads/", "Storage", "Secure file system directory for recipient proof photos, donation receipts, and volunteer CV uploads."],
    ["/Frontend/src/pages/", "Frontend Views", "Top-level page views (Home, AboutUs, FAQ, Public Donation Tracking, Login, Register)."],
    ["/Frontend/src/portals/", "Role Modules", "Role-based user portal layouts and specialized sub-views (Admin, Donor, Volunteer, Beneficiary, Staff)."],
    ["/Frontend/src/components/", "UI Components", "Reusable modular interface components divided into /admin, /layout, /shared, and /home."],
    ["/Frontend/src/context/", "State Management", "Global React Context providers (AuthContext.jsx, ThemeContext.jsx)."],
    ["/Frontend/src/hooks/", "Custom Logic", "Reusable custom React hooks (useApiList.js, usePagination.js)."],
    ["/Frontend/src/styles/", "Styling", "Global CSS stylesheets, CSS custom property design tokens, and role-specific portal styles."],
    ["/database/", "Persistence", "Master SQL schema files (donation_system.sql), seed fixtures, and DATABASE_METADATA.md documentation."],
    ["/mail-service/", "Microservice", "Express / Node.js background mail notification microservice for queueing transactional notices."]
]
create_styled_table(doc, folder_headers, folder_data, [1.8, 1.4, 3.8])

add_paragraph(doc, "Nested Rules & Naming: Components are grouped by feature domain. Any UI element reused across two or more portals must reside under /components/shared/. Folder names are lowercase with hyphens for services and PascalCase for React component containers.", bold_prefix="Nested Rules: ")

# 4.2.6 Taxonomy/Metadata Standards
add_heading_2(doc, "4.2.6. Taxonomy/Metadata Standards")
add_paragraph(doc, 
    "Purpose: Establishing rigorous taxonomy and metadata standards guarantees consistent data classification, predictable API contracts, "
    "structured code documentation, and unambiguous semantic versioning across the entire humanitarian relief system lifecycle.",
    bold_prefix="Purpose: ")

add_bullet(doc, "Database Schema Taxonomy: Tables are pluralized snake_case nouns (e.g., assistance_requests). Primary keys are consistently named id (BIGINT UNSIGNED AUTO_INCREMENT). Foreign keys strictly follow singular_parent_table_id. Audit timestamps created_at and updated_at are mandatory on all core transactional tables.", bold_prefix="Database Metadata: ")
add_bullet(doc, "API Metadata & Envelope: Every API endpoint returns explicit metadata headers (Content-Type: application/json; charset=utf-8, X-API-Version: 1.0.0). Paginated endpoints return metadata envelopes containing total_records, current_page, per_page, and total_pages.", bold_prefix="API Metadata: ")
add_bullet(doc, "Code Documentation Metadata: Standardized PHPDoc and JSDoc annotations (@param, @returns, @throws, @deprecated, @author) must precede all core utility routines and custom hooks.", bold_prefix="Code Tags: ")
add_bullet(doc, "Version Control & Releases: Semantic Versioning (SemVer 2.0.0) format (vMAJOR.MINOR.PATCH) is enforced (e.g., v1.0.0 Initial Capstone Release). Git commit messages follow Conventional Commits (feat:, fix:, docs:, refactor:, chore:).", bold_prefix="Semantic Versioning: ")
add_bullet(doc, "Feature & Environment Flags: Runtime flags (e.g., FEATURE_AI_VOLUNTEER_MATCHING=true, MAINTENANCE_MODE=false) dictate module behavior without code modifications.", bold_prefix="Feature Flags: ")

# 4.2.7 Deployment Standards
add_heading_2(doc, "4.2.7. Deployment Standards")
add_paragraph(doc, 
    "Deployment Environments: 1) Development (Local machine localhost:5173 / localhost:8000) for rapid feature iteration; "
    "2) UAT (Staging on Vercel and Render) for validation by Rise Above Foundation Cebu staff and SWU faculty panelists; and "
    "3) Production (Vercel Global CDN + Render Docker + TiDB Cloud Serverless) for live humanitarian operations.",
    bold_prefix="Environments: ")

add_paragraph(doc, "CI/CD Deployment Process & Pipeline:", bold_prefix="Pipeline: ")
add_bullet(doc, "1. Code Commit: Developer pushes feature commits to GitHub repository branches.", bold_prefix="Step 1: ")
add_bullet(doc, "2. Automated Trigger: GitHub webhook notifies Render and Vercel build pipelines.", bold_prefix="Step 2: ")
add_bullet(doc, "3. Build & Test: Vercel executes 'npm run build' (Vite bundle optimization and lint validation); Render builds Docker container with PHP 8.2 and Apache.", bold_prefix="Step 3: ")
add_bullet(doc, "4. Health Check Verification: Render verifies zero-downtime container readiness at /api/health.php before shifting live traffic.", bold_prefix="Step 4: ")
add_bullet(doc, "5. Database Migrations: Schema modifications are applied using transaction-safe migration scripts against TiDB Cloud.", bold_prefix="Step 5: ")

add_paragraph(doc, "Branching Strategy: A structured GitFlow model is implemented:", bold_prefix="Branching Strategy: ")
add_bullet(doc, "feature/*: Short-lived feature branches branched from develop.", bold_prefix="Features: ")
add_bullet(doc, "develop: Integration branch continuously deployed to the UAT / Staging environment.", bold_prefix="Develop: ")
add_bullet(doc, "main: Production-ready protected branch. Pushing or merging directly to main is restricted.", bold_prefix="Main: ")
add_bullet(doc, "hotfix/*: Emergency patches branched from main and back-merged to develop.", bold_prefix="Hotfix: ")

add_paragraph(doc, "Approval & Review Requirements: Merging into main requires a formal Pull Request (PR) with at least two peer reviews from capstone project members and validation that automated build checks succeed. Final approval is signed off by the Lead Developer.", bold_prefix="Approvals: ")

add_paragraph(doc, "Rollback Procedures:", bold_prefix="Rollback Procedures: ")
add_bullet(doc, "Frontend Instant Rollback (Vercel): Access Vercel Dashboard -> Deployments -> locate previous verified deployment -> click 'Rollback to this Deployment'. Rollback executes instantaneously within 15 seconds.", bold_prefix="Frontend: ")
add_bullet(doc, "Backend Rollback (Render): Access Render Dashboard -> Service Activity -> select prior working Docker image build -> trigger redeploy.", bold_prefix="Backend: ")
add_bullet(doc, "Database Rollback (TiDB Cloud): Point-In-Time Recovery (PITR) snapshots allow restoring the database state to any exact second prior to the failed deployment.", bold_prefix="Database: ")

# Save Word document
docx_path = r"c:\Users\James\DonationSystem\SWU_003_System_Design_and_Governance_Document_Sections.docx"
doc.save(docx_path)
print(f"Successfully saved Word Document to: {docx_path}")
