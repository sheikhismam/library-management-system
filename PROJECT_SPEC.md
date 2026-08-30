# PROJECT SPECIFICATION: Library Management System

## 1. System Overview & Core Objective
The **Library Management System (LMS)** is a modern, responsive web application engineered to streamline the daily operations of a library. The system provides complete management of books, authors, genres/categories, registered patrons/members, circulation (borrowing, renewals, returns), reservations queue, automated fine assessments, reader reviews, QR-code powered rapid check-in/check-out, comprehensive analytics dashboard, PDF reporting, and an immutable audit log trail.

### 1.1 Target Role & Scope
- **Application Role:** **Single Authenticated Role: Admin (Library Administrator / Staff)**.
- The Admin holds full privileges to manage the collection, register members, issue and return books, configure fine rates, collect payments, inspect audit logs, and export PDF summaries.
- Public/Patron access (if accessed without login) provides a read-only book catalog search with live availability status.

### 1.2 Target Timeline & Philosophy
- **Demo Goal:** Working, visually polished, fully integrated demo ready in 1–2 days.
- **Design Philosophy:** Clean, practical, modular architecture prioritizing high maintainability, intuitive UX, rapid responsiveness, and zero unnecessary enterprise bloat.

---

## 2. System Architecture

```
+-----------------------------------------------------------------------+
|                           CLIENT TIER (React)                         |
|   +---------------------------------------------------------------+   |
|   |  Vite + React 18/19 SPA  | Tailwind CSS | Lucide React Icons  |   |
|   |  - Responsive Admin Dashboard with Chart.js / Recharts        |   |
|   |  - QR Code Scanner (html5-qrcode camera integration)          |   |
|   |  - Real-time catalog search & filters                         |   |
|   |  - PDF export triggers & direct print preview                 |   |
|   +---------------------------------------------------------------+   |
+-----------------------------------^-----------------------------------+
                                    | HTTPS / REST JSON (JWT Auth)
+-----------------------------------v-----------------------------------+
|                         SERVER TIER (Django + DRF)                    |
|   +---------------------------------------------------------------+   |
|   |  Django 5.x + Django REST Framework                           |   |
|   |  - SimpleJWT Auth (Bearer token access & refresh)             |   |
|   |  - Modular Apps: Auth, Books, Members, Circulation, Reports   |   |
|   |  - QR Code Engine (qrcode + Pillow)                           |   |
|   |  - PDF Generation Engine (ReportLab)                          |   |
|   |  - Audit Log & Event Interceptor Service                      |   |
|   +---------------------------------------------------------------+   |
+-----------------------------------^-----------------------------------+
                                    | ORM (SQL)
+-----------------------------------v-----------------------------------+
|                         PERSISTENCE TIER                              |
|   +---------------------------------------------------------------+   |
|   |  SQLite (Local Demo / Fast Spin-up) / PostgreSQL Ready        |   |
|   |  Media Storage: Book covers, generated member & book QR PNGs  |   |
|   +---------------------------------------------------------------+   |
+-----------------------------------------------------------------------+
```

---

## 3. Database Entities & Relationships

### 3.1 Entity Relationship Diagram (Conceptual)
```
  +--------------+         +--------------+         +--------------+
  |    Author    |1       *|     Book     |*       *|   Category   |
  +--------------+---------+--------------+---------+--------------+
                                  |1
                                  |
               +------------------+------------------+
              1|                                    1|
        +--------------+                      +--------------+
        |  Borrowing   |*                     | Reservation  |*
        +--------------+                      +--------------+
               |*                                    |*
               |1                                    |1
        +--------------+                      +--------------+
        |    Member    |----------------------|    Review    |*
        +--------------+1                     +--------------+
               |1
               |*
        +--------------+
        |     Fine     |
        +--------------+
```

### 3.2 Data Models Specification

#### `Author`
- `id`: AutoField (PK)
- `name`: CharField(255), required
- `bio`: TextField, optional
- `birth_date`: DateField, optional
- `website`: URLField, optional
- `photo`: ImageField, optional
- `created_at`: DateTimeField(auto_now_add=True)

#### `Category`
- `id`: AutoField (PK)
- `name`: CharField(100), unique
- `slug`: SlugField(100), unique
- `description`: TextField, blank=True
- `created_at`: DateTimeField(auto_now_add=True)

#### `Book`
- `id`: UUIDField / AutoField (PK)
- `isbn`: CharField(20), unique, indexed
- `title`: CharField(255), indexed
- `subtitle`: CharField(255), blank=True
- `authors`: ManyToManyField(`Author`, related_name='books')
- `categories`: ManyToManyField(`Category`, related_name='books')
- `publisher`: CharField(200), blank=True
- `publication_year`: PositiveIntegerField, null=True
- `edition`: CharField(50), blank=True
- `pages`: PositiveIntegerField, null=True
- `language`: CharField(50), default='English'
- `description`: TextField, blank=True
- `cover_image`: ImageField, upload_to='books/covers/', null=True, blank=True
- `qr_code_image`: ImageField, upload_to='books/qrcodes/', null=True, blank=True
- `total_copies`: PositiveIntegerField, default=1
- `available_copies`: PositiveIntegerField, default=1
- `shelf_location`: CharField(100), blank=True (e.g., "Aisle 3, Shelf B2")
- `is_active`: BooleanField(default=True)
- `created_at`: DateTimeField(auto_now_add=True)
- `updated_at`: DateTimeField(auto_now=True)

#### `Member`
- `id`: AutoField (PK)
- `member_code`: CharField(30), unique, indexed (e.g., `MEM-2026-0001`)
- `first_name`: CharField(100)
- `last_name`: CharField(100)
- `email`: EmailField, unique
- `phone`: CharField(30)
- `address`: TextField, blank=True
- `membership_status`: CharField(choices=[('ACTIVE', 'Active'), ('EXPIRED', 'Expired'), ('SUSPENDED', 'Suspended'), ('INACTIVE', 'Inactive')], default='ACTIVE')
- `max_borrow_limit`: PositiveIntegerField, default=5
- `qr_code_image`: ImageField, upload_to='members/qrcodes/', null=True, blank=True
- `joined_date`: DateField(default=timezone.now)
- `expiry_date`: DateField, null=True, blank=True
- `notes`: TextField, blank=True
- `created_at`: DateTimeField(auto_now_add=True)
- `updated_at`: DateTimeField(auto_now=True)

#### `Borrowing` (Loan Record)
- `id`: AutoField (PK)
- `book`: ForeignKey(`Book`, on_delete=CASCADE, related_name='borrowings')
- `member`: ForeignKey(`Member`, on_delete=CASCADE, related_name='borrowings')
- `borrow_date`: DateTimeField(default=timezone.now)
- `due_date`: DateTimeField
- `return_date`: DateTimeField(null=True, blank=True)
- `status`: CharField(choices=[('BORROWED', 'Borrowed'), ('RETURNED', 'Returned'), ('OVERDUE', 'Overdue'), ('LOST', 'Lost')], default='BORROWED')
- `renewal_count`: PositiveIntegerField(default=0)
- `max_renewals`: PositiveIntegerField(default=2)
- `notes`: TextField, blank=True
- `created_at`: DateTimeField(auto_now_add=True)

#### `Fine`
- `id`: AutoField (PK)
- `borrowing`: ForeignKey(`Borrowing`, on_delete=CASCADE, related_name='fines')
- `member`: ForeignKey(`Member`, on_delete=CASCADE, related_name='fines')
- `amount`: DecimalField(max_digits=8, decimal_places=2)
- `status`: CharField(choices=[('PENDING', 'Pending'), ('PAID', 'Paid'), ('WAIVED', 'Waived')], default='PENDING')
- `daily_rate`: DecimalField(max_digits=5, decimal_places=2, default=1.00) # $1/day overdue
- `reason`: CharField(max_digits=255, default='Overdue book return')
- `paid_date`: DateTimeField(null=True, blank=True)
- `created_at`: DateTimeField(auto_now_add=True)

#### `Reservation`
- `id`: AutoField (PK)
- `book`: ForeignKey(`Book`, on_delete=CASCADE, related_name='reservations')
- `member`: ForeignKey(`Member`, on_delete=CASCADE, related_name='reservations')
- `reservation_date`: DateTimeField(default=timezone.now)
- `status`: CharField(choices=[('PENDING', 'Pending'), ('FULFILLED', 'Fulfilled'), ('CANCELLED', 'Cancelled'), ('EXPIRED', 'Expired')], default='PENDING')
- `priority`: PositiveIntegerField(default=1) # FIFO queue order
- `expiry_date`: DateTimeField(null=True, blank=True)
- `notified_at`: DateTimeField(null=True, blank=True)

#### `Review`
- `id`: AutoField (PK)
- `book`: ForeignKey(`Book`, on_delete=CASCADE, related_name='reviews')
- `member`: ForeignKey(`Member`, on_delete=CASCADE, related_name='reviews', null=True, blank=True)
- `reviewer_name`: CharField(150) # In case review is logged on behalf of reader
- `rating`: PositiveSmallIntegerField(validators=[1 to 5])
- `comment`: TextField, blank=True
- `is_approved`: BooleanField(default=True)
- `created_at`: DateTimeField(auto_now_add=True)

#### `AuditLog`
- `id`: AutoField (PK)
- `user`: ForeignKey(User, on_delete=SET_NULL, null=True, blank=True)
- `action`: CharField(50) # 'CREATE', 'UPDATE', 'DELETE', 'CHECKOUT', 'CHECKIN', 'RENEW', 'PAY_FINE', 'RESERVATION'
- `entity_type`: CharField(50) # 'Book', 'Member', 'Borrowing', 'Fine', etc.
- `entity_id`: CharField(100)
- `details`: JSONField(default=dict)
- `ip_address`: GenericIPAddressField(null=True, blank=True)
- `timestamp`: DateTimeField(auto_now_add=True)

---

## 4. REST API Structure

Base URL: `/api/v1/`

### 4.1 Authentication Endpoints
- `POST /api/v1/auth/login/` -> Obtain JWT access & refresh tokens
- `POST /api/v1/auth/refresh/` -> Refresh access token
- `GET  /api/v1/auth/me/` -> Current admin user details
- `POST /api/v1/auth/logout/` -> Blacklist refresh token

### 4.2 Books, Authors & Categories
- `GET, POST       /api/v1/books/` -> List (search/filter/paginate) & Create book
- `GET, PUT, DELETE /api/v1/books/{id}/` -> Retrieve, update, soft/hard delete
- `GET             /api/v1/books/lookup-isbn/?isbn=...` -> Instant lookup by ISBN
- `GET, POST       /api/v1/authors/` -> List & Create authors
- `GET, PUT, DELETE /api/v1/authors/{id}/` -> Manage author
- `GET, POST       /api/v1/categories/` -> List & Create categories
- `GET, PUT, DELETE /api/v1/categories/{id}/` -> Manage category

### 4.3 Members Management
- `GET, POST       /api/v1/members/` -> List members (search by code, name, phone) & Register member
- `GET, PUT, DELETE /api/v1/members/{id}/` -> Member details, edit, deactivate
- `GET             /api/v1/members/{id}/history/` -> Full borrowing & fine history
- `GET             /api/v1/members/lookup/?code=...` -> Instant lookup by member code or QR payload

### 4.4 Circulation & QR Operations
- `POST /api/v1/circulation/checkout/` -> Issue book (Book ID/ISBN + Member ID/Code)
- `POST /api/v1/circulation/checkin/` -> Return book (Book ID/ISBN or Borrowing ID)
- `POST /api/v1/circulation/renew/{id}/` -> Extend loan due date
- `GET  /api/v1/circulation/loans/` -> List active/overdue/returned loans with filter
- `GET  /api/v1/circulation/overdue/` -> List all overdue loans with calculated fines
- `POST /api/v1/circulation/qr-scan-action/` -> Unified endpoint receiving scanned QR payload (`BOOK:...` or `MEMBER:...`) and returning entity context + quick action options

### 4.5 Fines & Reservations
- `GET  /api/v1/fines/` -> List fines (filter by member, status)
- `POST /api/v1/fines/{id}/pay/` -> Mark fine as paid with payment date
- `POST /api/v1/fines/{id}/waive/` -> Mark fine as waived
- `GET, POST /api/v1/reservations/` -> List and create book reservations
- `POST /api/v1/reservations/{id}/cancel/` -> Cancel reservation
- `POST /api/v1/reservations/{id}/fulfill/` -> Fulfill reservation into a checkout

### 4.6 Reviews & Ratings
- `GET, POST /api/v1/reviews/` -> List & submit review
- `DELETE    /api/v1/reviews/{id}/` -> Delete review

### 4.7 Dashboard Analytics & Reports
- `GET /api/v1/analytics/dashboard/` -> Aggregated statistics:
  - Metric counters: Total Books, Total Titles, Active Loans, Overdue Loans, Total Members, Pending Fines ($), Collected Fines ($)
  - Trend data: Monthly borrowing trends (past 6-12 months)
  - Top 5 most borrowed books & Top genres breakdown
  - Recent activity feed (latest checkouts, returns, registrations)
- `GET /api/v1/reports/pdf/inventory/` -> Generate PDF Inventory Report
- `GET /api/v1/reports/pdf/overdue/` -> Generate PDF Overdue Loans Summary
- `GET /api/v1/reports/pdf/member/{id}/` -> Generate Member Borrowing Slip / History PDF
- `GET /api/v1/reports/pdf/receipt/{borrowing_id}/` -> Generate Loan Check-out/Return Receipt

### 4.8 Audit Logs
- `GET /api/v1/audit-logs/` -> Paginated log of system activities with search and date filter

---

## 5. QR Code Architecture

### 5.1 Code Encoding Format
1. **Book QR Payload:** `LMS:BOOK:<ISBN>` or `LMS:BOOK:ID:<UUID>`
2. **Member QR Payload:** `LMS:MEMBER:<MEMBER_CODE>`

### 5.2 Generation Engine
- Automatically generated upon creating or updating a Book or Member using Python `qrcode` + `Pillow`.
- Stored as high-resolution PNG in Django `media/` directory and served via API / CDN.
- Printable directly from the UI (e.g. printable shelf/book sticker sheet or member badge card).

### 5.3 Scanner Workflow (Frontend)
- Uses `html5-qrcode` accessing device camera (laptop webcam, phone camera, or 2D USB hardware barcode scanner input).
- Quick Scan Modal is accessible from anywhere in the navbar with hotkey shortcut (e.g., `Ctrl+K` or `F2`).
- Workflow:
  1. Scan Book -> System identifies book, displays current availability, and prompts for Member scan.
  2. Scan Member -> System pairs Book + Member and executes Instant Checkout with 1-click.
  3. Scan currently borrowed Book -> Instantly triggers Quick Check-in / Return dialog with fine calculation.

---

## 6. Search, Filter & Pagination Design
- **Global Search:** Multi-field icontains search across Title, ISBN, Author name, Category name, and Publisher.
- **Filters:**
  - By Category / Genre dropdown
  - By Availability (All, In Stock Only, Out of Stock)
  - By Publication Year range
- **Backend Pagination:** DRF Standard `PageNumberPagination` (default page size 12 for grid / 20 for tables).
- **Frontend State:** Instant search with 300ms debounce, URL query param syncing (`?search=...&category=...&page=1`).

---

## 7. Dashboard & Reporting Design

### 7.1 Key Dashboard Metrics
- **Card 1:** Total Books & Available Copies
- **Card 2:** Active Loans (Currently checked out)
- **Card 3:** Overdue Returns (Action required alert)
- **Card 4:** Total Registered Members
- **Card 5:** Pending & Collected Fines Revenue
- **Chart 1:** Monthly Borrowing Activity (Line / Bar chart)
- **Chart 2:** Popular Books & Categories (Doughnut / Bar chart)
- **Table:** Real-time Circulation Live Stream & Quick Action shortcuts

### 7.2 PDF Reporting (ReportLab Engine)
- Formatted with institutional header, logo/title, timestamp, filter criteria, striped data table, summary totals, and digital generation watermark.
- Streamed directly as `application/pdf` with `Content-Disposition: inline` or `attachment`.

---

## 8. Frontend UI/UX Structure (React + Tailwind CSS)

### 8.1 Page Routes
- `/login` -> Admin authentication portal
- `/dashboard` -> Overview KPIs, graphs, quick action widgets, recent activities
- `/books` -> Book catalog grid/table, advanced filters, QR code modal, Add/Edit modal
- `/books/:id` -> Detailed book view, circulation history, reviews list, printable QR badge
- `/authors` -> Author directory & associated books
- `/categories` -> Category/genre list & book counts
- `/members` -> Member directory, registration, status toggle, member ID card modal
- `/members/:id` -> Member profile, active borrowings, loan history, unpaid fines, print member card
- `/circulation` -> Active loans, quick check-out / check-in tab, return processing
- `/fines` -> Overdue fines register, payment collection, waiver processing
- `/reservations` -> Book reservation queue & fulfillment
- `/reports` -> Report generation hub (Inventory, Overdue, Financials) with PDF download
- `/audit-logs` -> Chronological security & activity history

### 8.2 Design System & Component Library
- Modern Clean Slate theme with Indigo/Slate color palette.
- High accessibility, clear typographic hierarchy, consistent card styling, floating modals, responsive sidebar navigation, interactive toast notifications for success/error handling.

---

## 9. Testing Strategy
- **Backend Unit & Integration Tests:**
  - Models: Validation rules, stock count constraints, unique constraints.
  - Circulation Engine: Ensure `available_copies` decreases on checkout and increases on checkin; test fine calculation logic on overdue loans.
  - API Endpoints: Test authentication requirements, 200/201/400/404 response codes, and serialization integrity.
- **Frontend Verification:**
  - Component rendering, API mock handling, routing guards, QR scanner trigger, and full build validation (`npm run build`).

---

## 10. Deployment & Execution Plan
- **Backend:** `python manage.py runserver` (Port 8000) with automatic SQLite database and fixture seeding script `python manage.py seed_data`.
- **Frontend:** Vite development server `npm run dev` (Port 5173) with API proxying or direct CORS handling.
- **Demo Ready:** One-click launch script / instructions provided to run both backend and frontend simultaneously.
