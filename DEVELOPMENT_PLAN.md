# DEVELOPMENT PLAN: Library Management System

This document outlines the step-by-step implementation plan for building the complete Library Management System. Each phase is self-contained, verifiable, and builds logically on the preceding phases.

---

## Phase 1: Environment Setup & Backend Project Scaffolding
- [ ] Initialize Python virtual environment and install backend dependencies:
  - `django`, `djangorestframework`, `django-cors-headers`, `djangorestframework-simplejwt`, `Pillow`, `qrcode`, `reportlab`, `pytest-django`.
- [ ] Create Django project `library_project` and modular app structure:
  - `apps.authentication`, `apps.books`, `apps.members`, `apps.circulation`, `apps.reviews`, `apps.reports`, `apps.audit_logs`.
- [ ] Configure `settings.py`:
  - Installed apps, CORS configuration, DRF settings (JWT default authentication, standard pagination), media/static file handling, database setup.
- [ ] Setup base URL routing and health-check endpoint (`/api/v1/health/`).
- **Verification:** Run Django check and runserver; verify health-check endpoint returns `200 OK`.

---

## Phase 2: Database Models, QR Code Engine & Migrations
- [ ] Define database models in respective apps:
  - `books`: `Author`, `Category`, `Book`
  - `members`: `Member`
  - `circulation`: `Borrowing`, `Fine`, `Reservation`
  - `reviews`: `Review`
  - `audit_logs`: `AuditLog`
- [ ] Implement auto-generation of QR code images via model signals / save overrides:
  - `Book`: Generates PNG encoding `LMS:BOOK:<ISBN>`
  - `Member`: Generates PNG encoding `LMS:MEMBER:<MEMBER_CODE>`
- [ ] Generate and run database migrations.
- [ ] Register all models in Django Admin with search fields, list filters, and thumbnail previews for quick administrative inspection.
- **Verification:** Run `python manage.py makemigrations` and `python manage.py migrate`; verify schema creation and admin registration.

---

## Phase 3: Core REST API Endpoints (CRUD & Lookup)
- [ ] Implement JWT Authentication endpoints (Login, Refresh, Me).
- [ ] Implement Serializers, ViewSets, and URLs for:
  - `Author` (CRUD + book counts)
  - `Category` (CRUD + book counts)
  - `Book` (CRUD + search by title/author/ISBN + category filter + stock availability + ISBN lookup)
  - `Member` (CRUD + search by code/name/phone + member lookup)
- [ ] Create audit log hook to automatically record create/update/delete operations.
- **Verification:** Run automated API test suite testing CRUD actions, pagination, search queries, and JWT permission enforcement.

---

## Phase 4: Circulation Business Logic (Checkout, Checkin, Fines, Reservations)
- [ ] Implement Circulation Service & API endpoints:
  - `POST /api/v1/circulation/checkout/`: Decrement `available_copies`, create `Borrowing`, validate member borrow limit & status.
  - `POST /api/v1/circulation/checkin/`: Increment `available_copies`, mark `Borrowing` returned, assess overdue days and auto-generate `Fine` if past `due_date`.
  - `POST /api/v1/circulation/renew/{id}/`: Validate max renewals, extend `due_date`.
  - `GET /api/v1/circulation/loans/`: List active, overdue, and returned loans with filter.
- [ ] Implement Fine Management endpoints:
  - `GET /api/v1/fines/`, `POST /api/v1/fines/{id}/pay/`, `POST /api/v1/fines/{id}/waive/`.
- [ ] Implement Reservation Queue endpoints:
  - `GET /api/v1/reservations/`, `POST /api/v1/reservations/`, `POST /api/v1/reservations/{id}/cancel/`.
- [ ] Implement Unified QR Scan Action endpoint:
  - `POST /api/v1/circulation/qr-scan-action/` -> Decodes QR string, retrieves entity, returns contextual actions.
- **Verification:** Write unit/integration tests verifying stock count decrements/increments, overdue fine calculation, and loan renewal limits.

---

## Phase 5: Reviews, Audit Logging & Analytics Dashboard Endpoints
- [ ] Implement Review endpoints (`GET`, `POST`, `DELETE` for book ratings and comments).
- [ ] Implement Audit Log retrieval endpoint (`GET /api/v1/audit-logs/` with filtering by action, user, date).
- [ ] Implement Analytics Dashboard API endpoint (`GET /api/v1/analytics/dashboard/`):
  - Total books, total copies, active loans, overdue count, total members, fines collected vs pending.
  - Monthly borrowing activity timeline.
  - Most borrowed books and popular categories.
  - Recent live circulation feed.
- **Verification:** Test analytics calculations against known test data to ensure aggregation formulas are exact.

---

## Phase 6: PDF Reporting Engine & Sample Data Seeder Command
- [ ] Build ReportLab PDF generator service producing formatted, professional PDF documents:
  - Inventory Report PDF (`/api/v1/reports/pdf/inventory/`)
  - Overdue Loans Summary PDF (`/api/v1/reports/pdf/overdue/`)
  - Member History & Borrowing Slip PDF (`/api/v1/reports/pdf/member/{id}/`)
- [ ] Build Django management command `python manage.py seed_data`:
  - Seeds default admin user (`admin` / `admin123`).
  - Seeds rich collection of categories, authors, and books with covers & ISBNs.
  - Seeds active members with member codes.
  - Seeds realistic borrowing records (active, returned, and overdue with fines), reservations, and reviews.
- **Verification:** Execute `python manage.py seed_data` and verify PDF endpoints generate valid, downloadable binary PDF files.

---

## Phase 7: Frontend Initialization, Design System & Auth Flow
- [ ] Initialize Vite + React application with Tailwind CSS and Lucide React icons.
- [ ] Setup Axios API client with automatic JWT token attachment and 401 refresh interceptor.
- [ ] Build Authentication context and state management.
- [ ] Create layout architecture:
  - `AuthLayout`: Sleek, professional login view.
  - `DashboardLayout`: Sidebar navigation, global header with quick QR scanner button, notification bell, admin profile dropdown.
- **Verification:** Verify frontend builds cleanly (`npm run build`), login flow works against backend API, and token is persisted securely.

---

## Phase 8: Frontend Catalog & Member Management
- [ ] Build **Books Module**:
  - Grid & Table views with cover images, availability badges, category chips, shelf location.
  - Real-time search and category/availability filters.
  - Book Detail Modal / Page with circulation history, reviews, and printable QR sticker.
  - Add / Edit Book modal with ISBN auto-fill or manual entry.
- [ ] Build **Authors & Categories Module**:
  - Manage authors and genres with book count metrics.
- [ ] Build **Members Module**:
  - Member directory table with search, status badges, and active loans count.
  - Member Detail Modal with borrowing history and unpaid fines tab.
  - Add / Edit Member modal.
  - Printable Digital Member ID Card with QR code.
- **Verification:** Test all CRUD actions, search filters, modals, and QR badge rendering on frontend.

---

## Phase 9: Frontend Circulation Hub & Interactive QR Scanner
- [ ] Build **Circulation Operations Page**:
  - Active Loans table with return and renewal action buttons.
  - Overdue Loans tab with highlighted fine amounts.
  - Issue Book (Check-out) form with live member & book selection / autocomplete.
- [ ] Build **Interactive Camera QR Code Scanner (`html5-qrcode`)**:
  - Floating QR scanner modal with live camera viewfinder.
  - Auto-detection of `LMS:BOOK:...` and `LMS:MEMBER:...`.
  - Rapid Check-out flow: Scan Book -> Scan Member -> Confirm Issue in seconds.
  - Rapid Check-in flow: Scan Book -> Instant return with fine assessment alert.
- **Verification:** Test scanner with simulated camera input / static QR image uploads, and verify full checkout/checkin cycle.

---

## Phase 10: Frontend Dashboard, Fines, Reservations, Reports & Audit Log
- [ ] Build **Analytics Dashboard**:
  - Stat cards with icons, percentages, and trend indicators.
  - Interactive Chart.js / Recharts visualizations (Borrowing Trends, Genre Distribution).
  - Recent activity feed stream.
  - Quick action shortcuts.
- [ ] Build **Fines & Reservations Pages**:
  - Fines table with direct "Pay Fine" and "Waive Fine" actions.
  - Reservations queue with "Fulfill" and "Cancel" buttons.
- [ ] Build **Reports Hub**:
  - Direct PDF preview & download buttons for Inventory, Overdue, and Member statements.
- [ ] Build **Audit Logs Viewer**:
  - Chronological activity table with action badges, user info, timestamp, and details inspector modal.
- **Verification:** Verify all pages render correctly, charts load live data, and PDF downloads trigger successfully.

---

## Phase 11: End-to-End Testing, Documentation & One-Click Run Setup
- [ ] Run full backend automated test suite.
- [ ] Run frontend production build test (`npm run build`).
- [ ] Create `run_demo.bat` / PowerShell startup script to launch backend and frontend simultaneously with a single command.
- [ ] Update `PROJECT_STATUS.md` with final verification checklist, demo credentials, and walkthrough instructions.
