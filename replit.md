# CareConnect - Multi-Tenant Care Management System

## Overview
CareConnect is a comprehensive, multi-tenant healthcare facility management platform designed to streamline care operations. It provides role-based access control, GPS-verified shift logging, dynamic forms, and real-time analytics while ensuring strict data isolation between tenants. The system aims to enhance efficiency in care management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
CareConnect is built with a modern web stack, featuring a React 18 and TypeScript frontend utilizing Tailwind CSS with shadcn/ui for UI, TanStack Query for data, Wouter for routing, and Vite for building. The backend is an Express.js server with TypeScript, employing Passport.js for authentication and Drizzle ORM for PostgreSQL database interactions.

**Key Architectural Decisions:**
-   **Multi-Tenancy:** Company-based tenant separation at the database level (PostgreSQL) with comprehensive composite foreign key constraints ensuring data privacy and isolation.
-   **Role-Based Access Control:** Five permission levels (SupportWorker, TeamLeader, Coordinator, Admin, ConsoleManager) with granular control over UI rendering and API access.
-   **Session-Based Authentication:** Secure, scalable session management using Passport.js and PostgreSQL.
-   **RESTful API:** Designed for comprehensive error handling and logging.
-   **Dynamic Forms:** Rendered from JSON schemas with client and server-side validation.
-   **Automated Provisioning:** Ensures all tenants receive a consistent set of core features (e.g., pay scales, NDIS pricing, tax brackets) upon creation, with an absolute zero-demo-data policy for organic content creation.
-   **Modular Design:** Core modules include Client, Staff, Shift, Dynamic Forms, Case Notes, Medication, Incident, and Observation Management, along with Workflow Dashboard, Roles & Permissions, Staff Hour Allocation, and Internal Messaging.
-   **Real-time Capabilities:** Live dashboards, activity monitoring, and analytics.
-   **UI/UX:** TUSK-inspired design system with a professional color palette (Deep Navy, Warm Gold, Sage Green, Cream), modern aesthetics, responsive layouts, accessibility features, and consistent branding.
-   **Comprehensive PDF Export:** Reusable utility with professional formatting, company branding, multi-page support, and structured content rendering for various reports (Care Plans, Case Notes, Incident Reports, Payslips).
-   **Automated Timesheet System:** Australian payroll-compliant auto-timesheet system with ScHADS pay scales, employment type separation, leave accrual tracking, and payslip generation.
-   **GPS Location Tracking:** For shift check-in/check-out with human-readable address display.
-   **AI Integration:** Used for generating care plan content, with comprehensive client data integration and pronoun consistency across all sections.

## External Dependencies
-   **Database:** PostgreSQL (with `@neondatabase/serverless` for serverless connections, `connect-pg-simple` for session store).
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