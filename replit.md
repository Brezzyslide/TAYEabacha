# CareConnect - Multi-Tenant Care Management System

## Overview
CareConnect is a comprehensive, multi-tenant healthcare facility management platform designed to streamline care operations. It provides role-based access control, GPS-verified shift logging, dynamic forms, and real-time analytics while ensuring strict data isolation between tenants. The system aims to enhance efficiency in care management and has significant market potential as a robust solution for healthcare facilities.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
CareConnect is built with a modern web stack:
-   **Frontend:** React 18, TypeScript, Tailwind CSS with shadcn/ui for UI, TanStack Query for data, Wouter for routing, and Vite for building.
-   **Backend:** Express.js server with TypeScript, Passport.js for authentication, and Drizzle ORM for PostgreSQL database interactions.
-   **Modular Backend:** NDIS Service Agreement module with complete CRUD operations, PDF export, tenant isolation, and role-based access control at `/api/compliance/service-agreements`.

**Key Architectural Decisions:**
-   **Multi-Tenancy:** Company-based tenant separation at the PostgreSQL database level with composite foreign key constraints ensuring data privacy and isolation.
-   **Role-Based Access Control:** Five permission levels (SupportWorker, TeamLeader, Coordinator, Admin, ConsoleManager) for granular control over UI rendering and API access.
-   **Session-Based Authentication:** Secure, scalable session management using Passport.js and PostgreSQL.
-   **RESTful API:** Designed with comprehensive error handling and logging.
-   **Dynamic Forms:** Rendered from JSON schemas with client and server-side validation.
-   **Automated Provisioning:** Ensures all tenants receive a consistent set of core features upon creation.
-   **Modular Design:** Includes modules for Client, Staff, Shift, Dynamic Forms, Case Notes, Medication, Incident, Observation Management, Workflow Dashboard, Roles & Permissions, Staff Hour Allocation, and Internal Messaging.
-   **Real-time Capabilities:** Supports live dashboards, activity monitoring, and analytics.
-   **UI/UX:** TUSK-inspired design system featuring a professional color palette (Deep Navy, Warm Gold, Sage Green, Cream), modern aesthetics, responsive layouts, accessibility features, and consistent branding.
-   **Comprehensive PDF Export:** Reusable utility with professional formatting, company branding, multi-page support, and structured content rendering for various reports.
-   **Automated Timesheet System:** Australian payroll-compliant auto-timesheet system with ScHADS pay scales, employment type separation, and leave accrual tracking.
-   **GPS Location Tracking:** For shift check-in/check-out with human-readable address display.
-   **AI Integration:** Used for generating care plan content, with comprehensive client data integration and pronoun consistency.
-   **Production Readiness:** Designed for Linux environments with Node.js 20.x, comprehensive environment validation, fail-fast mechanisms, secure authentication cookies, production security headers, health endpoints, and structured JSON logging. Separated frontend/backend builds with static file serving and SPA routing support. Production-ready database migration system.

## External Dependencies
-   **Database:** PostgreSQL (`@neondatabase/serverless` for serverless connections, `connect-pg-simple` for session store).
-   **ORM:** Drizzle ORM.
-   **Authentication:** Passport.js, Passport-Local.
-   **UI Components:** @radix-ui/ components, lucide-react (icons).
-   **Styling:** Tailwind CSS.
-   **Data Management:** TanStack Query.
-   **Date Manipulation:** date-fns.
-   **Build Tools:** Vite, ESBuild, TypeScript.
-   **PDF Generation:** jsPDF.
-   **Excel Processing:** XLSX library.
-   **File Uploads:** Multer.
-   **Geocoding:** Nominatim (for reverse geocoding).
-   **Email:** Gmail SMTP.