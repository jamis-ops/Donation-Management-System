# End-to-End Production Deployment Guide
**System:** Rise Above Foundation Cebu — Donation & Relief Management System  
**Target Architecture:**
- **Database:** TiDB Cloud (Serverless MySQL 8.0 Compatible)
- **Email Service:** Brevo API (Transactional Mail)
- **AI Matching:** Google Gemini API (Server-Side)
- **Backend:** Render (Dockerized PHP 8.2 + Apache REST API)
- **Frontend:** Vercel (React 18/19 + Vite SPA)

---

## Quick Navigation Index
1. [Prerequisites](#prerequisites)
2. [Step 1: TiDB Cloud Database Setup](#step-1-tidb-cloud-database-setup)
3. [Step 2: Brevo Email Setup](#step-2-brevo-email-setup)
4. [Step 3: Google Gemini AI Key Setup](#step-3-google-gemini-ai-key-setup)
5. [Step 4: Push Code to GitHub](#step-4-push-code-to-github)
6. [Step 5: Render Backend Deployment](#step-5-render-backend-deployment)
7. [Step 6: Vercel Frontend Deployment](#step-6-vercel-frontend-deployment)
8. [Step 7: Connect Frontend & Backend (Final Sync)](#step-7-connect-frontend--backend-final-sync)
9. [Step 8: Post-Deployment Testing & Verification](#step-8-post-deployment-testing--verification)

---

## Prerequisites
Before you begin, ensure you have accounts created for:
1. **GitHub** ([github.com](https://github.com)) — to host your codebase repository.
2. **TiDB Cloud** ([tidbcloud.com](https://tidbcloud.com)) — Free Serverless MySQL Tier.
3. **Brevo** ([brevo.com](https://www.brevo.com)) — Free Tier for transactional emails (300 emails/day).
4. **Google AI Studio** ([aistudio.google.com](https://aistudio.google.com)) — for Gemini API key.
5. **Render** ([render.com](https://render.com)) — Free Web Service hosting for backend Docker.
6. **Vercel** ([vercel.com](https://vercel.com)) — Free Hobby Tier for Vite/React frontend.

---

## Step 1: TiDB Cloud Database Setup

### 1.1 Create a Free Serverless Cluster
1. Open [https://tidbcloud.com](https://tidbcloud.com) and log in.
2. On the **Clusters** dashboard, click the button: **"+ Create Cluster"** (or **"Create Cluster"**).
3. Select the **Serverless** tier (Free tier: 5 GiB storage, 50 million Request Units/month free).
4. Choose the cloud provider & region:
   - Provider: **AWS**
   - Region: Choose **Singapore (`ap-southeast-1`)** or the region closest to the Philippines.
5. Name your cluster (e.g., `rafc-donation-db`).
6. Click **"Create"**. Your cluster will take about 15–30 seconds to provision.

### 1.2 Get Database Connection Credentials & Set Password
1. Once the cluster status shows **Running**, click on your cluster name.
2. In the top-right corner, click the green **"Connect"** button.
3. In the connection modal:
   - Set **Connect With**: Select **General / MySQL CLI** (or **Connection String / Parameters**).
   - If prompted to set a root password, click **"Reset Password"** or **"Generate Password"**.
   - ⚠️ **COPY AND SAVE THIS PASSWORD IMMEDIATELY**.
4. Note down the connection parameters shown:
   - **Host:** e.g., `gateway01.ap-southeast-1.prod.aws.tidbcloud.com`
   - **Port:** `4000`
   - **User:** e.g., `2fXxxxxx.root` (Notice the prefix before `.root`, this full string is the username!)
   - **Database:** `donation_system` (we will create this in the next step)

### 1.3 Import the Database Schema
1. In the TiDB Cloud console for your cluster, click on the **"SQL Editor"** tab on the left sidebar.
2. In the top database selector, if `donation_system` does not appear, type:
   ```sql
   CREATE DATABASE IF NOT EXISTS donation_system CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
   USE donation_system;
   ```
3. Open the file `database/donation_system.sql` in your local project folder.
4. Copy the entire contents of `database/donation_system.sql` and paste it into the TiDB Cloud **SQL Editor** text area.
5. Click the blue **"Run"** button (or press `Ctrl+Enter`).
6. Verify that all tables (`users`, `donations`, `beneficiaries`, `inventory_items`, `repacking_jobs`, `distributions`, `tasks`, etc.) are created successfully with a green success status.

---

## Step 2: Brevo Email Setup

### 2.1 Verify Sender Email Address
1. Open [https://app.brevo.com](https://app.brevo.com) and log in.
2. Click on your profile name in the top-right corner -> Select **"Senders, Domains & Dedicated IPs"** (or go to [https://app.brevo.com/senders](https://app.brevo.com/senders)).
3. Under the **Senders** tab, click **"Add a sender"** (or **"Add an email address"**).
4. Fill in:
   - **From Name:** `Rise Above Foundation Cebu`
   - **Email Address:** Your organization email (e.g., `contact@riseabovefoundation.org` or your personal Gmail address if testing).
5. Click **"Save"**.
6. Check the inbox of that email address and click the verification link sent by Brevo.

### 2.2 Generate Brevo v3 API Key
1. Click your profile name in the top-right corner -> Select **"SMTP & API"** (or go to [https://app.brevo.com/settings/keys/api](https://app.brevo.com/settings/keys/api)).
2. Click on the **"API Keys"** tab.
3. Click the blue button **"Generate a new API key"**.
4. Name the key: `Donation System Production API`.
5. Click **"Generate"**.
6. ⚠️ **Copy the generated API key** (it starts with `xkeysib-...`). Save it securely.

---

## Step 3: Google Gemini AI Key Setup

1. Open [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Log in with your Google account.
3. Click **"Create API key"**.
4. Select a Google Cloud project (or create a default one).
5. Copy the generated API key (it starts with `AIzaSy...`). Save it securely.

---

## Step 4: Push Code to GitHub

1. Open your terminal in the project root directory (`c:\Users\James\DonationSystem`).
2. Verify git status and commit any outstanding changes:
   ```bash
   git status
   git add .
   git commit -m "Prepare production deployment files"
   ```
3. Push your branch to GitHub:
   ```bash
   git push origin main
   ```
   *(Or push your active branch `git push origin deploy`)*.

---

## Step 5: Render Backend Deployment

### 5.1 Create the Web Service
1. Open [https://dashboard.render.com](https://dashboard.render.com) and log in.
2. Click the **"New +"** button in the top navigation bar -> Select **"Web Service"**.
3. Under **Connect a repository**, select your GitHub repository (`Donation-Management-System`).
4. On the configuration screen, enter the following settings:
   - **Name:** `donation-system-api` (or any name you prefer)
   - **Region:** `Singapore (Southeast Asia)` *(closest to Philippines and TiDB Cloud)*
   - **Branch:** `main` *(or `deploy`)*
   - **Root Directory:** `Backend` ⚠️ *(Crucial: Type `Backend` here)*
   - **Runtime / Language:** Select **Docker** (Render will automatically detect `Backend/Dockerfile`)
   - **Instance Type:** Select **Free** ($0/month)

### 5.2 Set Backend Environment Variables
Scroll down to the **"Environment Variables"** section and click **"Add Environment Variable"** for each of the following:

| Key | Value / Source | Description |
| :--- | :--- | :--- |
| `DB_HOST` | `gateway01.xxx.tidbcloud.com` | From Step 1.2 (TiDB Cloud Host) |
| `DB_PORT` | `4000` | TiDB Cloud Port |
| `DB_NAME` | `donation_system` | Database Name |
| `DB_USER` | `xxxx.root` | From Step 1.2 (Full TiDB Username) |
| `DB_PASSWORD` | `your-tidb-password` | From Step 1.2 (TiDB Password) |
| `DB_SSL` | `true` | Enables TLS for TiDB Cloud |
| `GEMINI_API_KEY` | `AIzaSy...` | From Step 3 (Google AI Studio) |
| `BREVO_API_KEY` | `xkeysib-...` | From Step 2.2 (Brevo API Key) |
| `MAIL_FROM_EMAIL` | `contact@riseabovefoundation.org` | From Step 2.1 (Verified Brevo Sender) |
| `MAIL_FROM_NAME` | `Rise Above Foundation Cebu` | Email display name |
| `FRONTEND_URL` | `https://donation-system-frontend.vercel.app` | Leave as temporary placeholder until Step 6 |

### 5.3 Configure Health Check & Deploy
1. Click **"Advanced"** at the bottom of the form.
2. Set **Health Check Path** to: `/api/health.php`
3. Click the blue button: **"Deploy Web Service"** (or **"Create Web Service"**).
4. Watch the build logs. Render will pull the PHP 8.2 Apache image, configure modules, and start Apache.
5. Once deployed, Render will display your live backend URL at the top left under the service title:
   - e.g., `https://donation-system-api.onrender.com`
6. Copy this URL. Test it in your browser:
   - Open `https://donation-system-api.onrender.com/api/health.php`
   - It should return: `{"status":"ok"}`.

---

## Step 6: Vercel Frontend Deployment

### 6.1 Import Project into Vercel
1. Open [https://vercel.com/dashboard](https://vercel.com/dashboard) and log in with GitHub.
2. Click the button: **"Add New..."** -> Select **"Project"**.
3. Under **Import Git Repository**, find your repository and click **"Import"**.

### 6.2 Configure Project Settings
In the configuration screen:
1. **Project Name:** `donation-system` (or your preferred name).
2. **Framework Preset:** Select **Vite** (Vercel usually auto-detects this).
3. **Root Directory:** Click **"Edit"** next to Root Directory -> Select the `Frontend` folder -> Click **"Continue"**.
4. **Build and Output Settings:** Leave as defaults:
   - Build Command: `vite build`
   - Output Directory: `dist`
   - Install Command: `npm install`

### 6.3 Set Frontend Environment Variable
Expand the **"Environment Variables"** accordion and add:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://donation-system-api.onrender.com` | Paste your actual Render backend URL from Step 5.3 **(without trailing slash)** |

### 6.4 Deploy
1. Click the blue **"Deploy"** button.
2. Vercel will build the React application and deploy it to a global CDN.
3. Once complete, click **"Continue to Dashboard"** or click on the preview window to get your live frontend URL:
   - e.g., `https://donation-system-frontend.vercel.app`
4. Copy your live Vercel URL.

---

## Step 7: Connect Frontend & Backend (Final Sync)

Now that both URLs are live, link them so CORS and session cookies work seamlessly across domains:

1. Open [https://dashboard.render.com](https://dashboard.render.com).
2. Select your `donation-system-api` Web Service.
3. Click on the **"Environment"** tab on the left sidebar.
4. Locate the `FRONTEND_URL` variable.
5. Click the edit icon (or edit value) and set it to your exact Vercel URL from Step 6.4:
   - e.g., `https://donation-system-frontend.vercel.app` *(no trailing slash)*.
6. Click **"Save Changes"**. Render will automatically redeploy the backend with the new CORS origin in ~30 seconds.

---

## Step 8: Post-Deployment Testing & Verification

Go through this checklist on your live Vercel website:

- [ ] **1. Public Pages:**
  - Visit the homepage (`/`), about page (`/about`), FAQ (`/faq`), and public donation tracker.
  - Verify images, styles, and public relief distribution maps load cleanly.
- [ ] **2. Authentication:**
  - Visit `/login`.
  - Log in with the default admin account:
    - **Email:** `admin@riseabovefoundation.org`
    - **Password:** `admin123` *(or your configured password)*.
  - Verify that you are redirected to `/admin/dashboard` with session cookies active.
- [ ] **3. Super Admin Database Management:**
  - Log in with Super Admin credentials.
  - Navigate to Database Management to inspect live TiDB Cloud table statuses and row counts.
- [ ] **4. Donation Intake & Verification:**
  - Submit a public monetary or in-kind donation on `/donate`.
  - Check the Admin Portal -> Donations page to verify the pending donation and approve it.
- [ ] **5. Email Notifications (Brevo):**
  - Trigger an invite or user registration to confirm transactional emails land in the recipient's inbox.
- [ ] **6. Volunteer AI Matching (Gemini):**
  - Open Admin Portal -> Volunteers -> Volunteer Detail / AI Matching tab.
  - Run the AI recommendation tool to confirm Gemini parses CV skills and suggests matching community programs.
- [ ] **7. Browser Refresh & Direct Links:**
  - Refresh the page while on a deep sub-route like `/admin/inventory` or `/portals/donor/certificates`.
  - Verify that the page reloads properly without returning a 404 error.

---

## Troubleshooting Common Issues

### Issue 1: "Cannot reach PHP backend" or CORS errors
- **Fix:** In Render Dashboard -> Environment, verify that `FRONTEND_URL` matches your Vercel URL exactly (including `https://` with no trailing `/`). In Vercel Dashboard -> Environment Variables, verify that `VITE_API_URL` matches your Render URL.

### Issue 2: Login redirects back to login (Session dropped)
- **Fix:** Cross-domain cookies require HTTPS on both ends. Ensure both Vercel and Render are accessed using `https://`. Verify `cors.php` and `login.php` have `SameSite=None; Secure` enabled.

### Issue 3: Render backend cold starts take ~40 seconds
- **Explanation:** Render free tier spins down services after 15 minutes of inactivity. When the first visitor loads the site, Render will take ~30–40 seconds to spin up the container. This is standard behavior on Render's free tier.

---

🎉 **Congratulations! Your Donation & Relief Management System is now live and running in production!**
