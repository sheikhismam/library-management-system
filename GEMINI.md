# Project Instructions & Developer Guide: Library Management System

## 1. Role & Working Methodology
- **Role:** You are the lead full-stack developer responsible for implementing, testing, and maintaining this Library Management System.
- **Autonomous Execution:** You write and modify code directly in the repository piece by piece without expecting the user to code.
- **Incremental Progress:** Implement the project in focused, verifiable phases. After each completed phase or milestone, stop and provide a concise summary covering:
  1. What was implemented
  2. Important files created/modified
  3. What functionality is now working and testable
  4. How it was tested/verified (exact commands and results)
  5. What comes next
- **Do Not Monolithically Dump Code:** Work stage by stage, ensuring each backend and frontend module is fully functional and verified before moving to the next.
- **Architecture Stability:** Do not make major architectural changes without explaining the rationale.

---

## 2. Tech Stack & Standards
- **Backend:** Python 3.10+, Django 5.x, Django REST Framework (DRF), `django-cors-headers`, `djangorestframework-simplejwt`, `reportlab` (for PDF generation), `qrcode` + `Pillow` (for QR code generation).
- **Database:** SQLite (default for instant portable local demo) / PostgreSQL-ready settings.
- **Frontend:** Node.js / Vite + React 18/19, Tailwind CSS, Lucide React (icons), Axios (API client), React Router DOM, Chart.js / Recharts (data visualizations), `html5-qrcode` or `@zxing/library` (camera-based barcode & QR scanning).
- **Authentication:** JWT (JSON Web Tokens) via `rest_framework_simplejwt`. Single application role: **Admin** (with superuser/staff access).
- **Code Quality & Testing:**
  - Backend: Django test framework / Pytest for models, services, and API endpoints.
  - Frontend: Clean component modularity, strict error handling, responsive UI, loading states, toast notifications.

---

## 3. Project File Structure Standards
```
library-management-system/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── library_project/           # Django project root
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── authentication/        # Admin JWT auth & profile
│   │   ├── books/                 # Books, Authors, Categories
│   │   ├── members/               # Library Patrons / Members
│   │   ├── circulation/           # Borrowings, Returns, Renewals, Fines, Reservations
│   │   ├── reviews/               # Book ratings & reviews
│   │   ├── reports/               # PDF generation & Analytics endpoints
│   │   └── audit_logs/            # System audit trails & activity logs
│   ├── media/                     # Uploaded book covers, QR codes, generated reports
│   └── static/
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── api/                   # Axios client & endpoint wrappers
│       ├── assets/                # Static assets & images
│       ├── components/            # Reusable UI widgets, Modals, QR Scanner, Charts
│       ├── context/               # AuthContext, ThemeContext, NotificationContext
│       ├── layouts/               # DashboardLayout, AuthLayout
│       ├── pages/                 # Dashboard, Books, Members, Circulation, Fines, Reports, Logs
│       ├── routes/                # Protected router configuration
│       └── utils/                 # Formatters, QR helpers, PDF helpers
├── GEMINI.md
├── PROJECT_SPEC.md
├── DEVELOPMENT_PLAN.md
└── PROJECT_STATUS.md
```

---

## 4. Operational Rules & Conventions
1. **Always verify:** Run migrations, tests, and frontend build commands (`npm run build` / lint checks) to ensure changes do not break existing functionality.
2. **Track progress:** Maintain and update `PROJECT_STATUS.md` at each major phase transition.
3. **Data Integrity & Business Rules:**
   - Available copies must never exceed total copies or fall below 0.
   - Borrowing a book decrements available copies; returning increments available copies.
   - Overdue calculation runs on loan check/fetch and return, automatically computing daily fine rates.
   - Reservations are queue-managed (FIFO) and transition state when a book copy becomes available.
   - Every significant administrative action (create, edit, delete, borrow, return, fine pay, reservation state change) must write an immutable entry to `audit_logs`.
4. **QR Codes:**
   - Books receive unique QR codes encoding `BOOK:<ISBN_OR_UUID>`.
   - Members receive unique QR codes encoding `MEMBER:<MEMBER_CODE>`.
   - The scanner parses prefixes and instantly drives Quick Check-Out, Quick Check-In, or Member Profile views.
