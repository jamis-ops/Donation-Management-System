# Optimizing Resource Allocation in Disaster Relief Operations Through Web-Based Donation System

A centralized web-based donation and relief management platform developed for **Rise Above Foundation Cebu**. The system streamlines donation workflows, inventory tracking, relief kit repacking, volunteer duty scheduling, and barangay assistance distribution during disaster response operations.

---

## Project Description

The platform automates and optimizes humanitarian aid logistics to ensure prompt, fair, and transparent aid delivery to affected communities.

### User Roles & Portals
- **Administrator**: Full system management, resource allocation, donation validation, user access, and reporting.
- **Staff**: Inventory management, relief kit repacking, donation intake verification, and logistics coordination.
- **Volunteers**: View assigned tasks, check shift schedules, track duty hours, and receive participation certificates.
- **Barangay / Beneficiaries**: Submit relief requests, monitor distribution schedules, and upload distribution proof documentation.
- **Donors**: Submit monetary and in-kind contributions, track donation status in real time, and download verified certificates.

---

## Features

- **Smart Resource Allocation**: Matches emergency relief requests with real-time inventory and kit availability.
- **Inventory & Repacking Management**: Tracks stock levels, expiration dates, low-stock alerts, and repackaging into disaster relief packs.
- **Volunteer Coordination**: Task assignment, skill matching, duty scheduling, and automated duty hours verification.
- **Transparent Distribution Logistics**: End-to-end status tracking (*Assigned* → *In Transit* → *Delivered* → *Verified*) with photo proof submission.
- **Donation Processing & Certificates**: In-kind tracking, monetary donation logs, and verifiable digital certificates.
- **Analytics & Reporting**: Exportable reports on relief operations, donor contributions, and aid distributions.

---

## Setup Instructions

### Prerequisites
- **Node.js** (v18 or higher) & **npm**
- **PHP** (v8.0 or higher with `pdo_sqlite` or `pdo_mysql` enabled)
- **Git**

### Installation & Local Run

1. **Clone the Repository**
   ```bash
   git clone https://github.com/jamis-ops/Donation-Management-System.git
   cd Donation-Management-System
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

3. **Start the Backend API Server**
   ```bash
   npm run api
   ```
   *Runs the PHP API server on `http://localhost:8000`.*

4. **(Optional) Start the Mail Notification Service**
   ```bash
   npm run mail
   ```
   *Runs the email notification service on `http://localhost:3001`.*

5. **Start the Frontend Application**
   ```bash
   npm run dev
   ```
   *Access the web application at `http://localhost:5173`.*

6. **Build for Production**
   ```bash
   npm run build
   ```

---

## File Structure

```
DonationSystem/
├── api/                # PHP backend API endpoints, auth handlers, and database queries
├── mail-service/       # Express-based email notification microservice
├── public/             # Public static assets, icons, and logos
├── scripts/            # Startup scripts for backend and mail services
├── src/
│   ├── assets/         # UI images, program illustrations, and logos
│   ├── components/     # Reusable UI components, modals, tables, and layouts
│   │   ├── admin/      # Admin navigation, tables, filters, and stat cards
│   │   ├── layout/     # Public header, footer, and navigation components
│   │   └── shared/     # Shared dialogs, badges, and feedback components
│   ├── context/        # React context providers (AuthContext, ThemeContext)
│   ├── hooks/          # Custom React hooks (useApiList, usePagination, etc.)
│   ├── pages/          # Public landing pages and Admin module views
│   ├── portals/        # Role-specific portals (Donor, Volunteer, Beneficiary, Staff)
│   └── styles/         # CSS design systems, themes, and portal styles
├── index.html          # Frontend HTML entry point
├── package.json        # Project metadata and npm scripts
└── vite.config.js      # Vite build and proxy configuration
```

---

## Contact Information

**Capstone Project Team**  
- **Members**: Julie Anne Utrera, Aubrie Marie Dual, Sheena Marie Dinaguit, James Lloyd Isidro  
- **Emails**: `julieanneutrera05@gmail.com`, `aubriemariedual13@gmail.com`, `sheenamariedinaguit@gmail.com`, `jamesisidro0808@gmail.com`  
- **School**: Southwestern University PHINMA  
- **Location**: Cebu City, Philippines  

---

## License

**Proprietary License**  
Copyright © 2026 Southwestern University PHINMA. All rights reserved.
Unauthorized copying, modification, distribution, or use of this software and associated documentation files is strictly prohibited.
