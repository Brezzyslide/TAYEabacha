# CareConnect - Multi-Tenant Care Management System

## Overview
CareConnect is a comprehensive, multi-tenant healthcare facility management platform designed to streamline care operations. It provides role-based access control, GPS-verified shift logging, dynamic forms, and real-time analytics while ensuring strict data isolation between tenants. The system aims to enhance efficiency in care management.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
**2025-08-05**: ✅ **DOCKER PRODUCTION DEPLOYMENT FIXED** - Resolved critical Docker startup issues:
- Fixed Node.js path resolution by upgrading from Node.js 18 to Node.js 20 in Dockerfile
- Created production-start.js script with import.meta.dirname polyfill for Linux server compatibility
- Added comprehensive Linux server deployment guide (LINUX_SERVER_DEPLOYMENT.md)
- **FIXED LINUX SERVER HANGING**: Optimized tenant processing with batching, timeouts, and concurrent processing
- Enhanced comprehensive tenant fixes to prevent hanging on startup (processes 21 tenants efficiently)
- Verified production build works: health endpoint responds successfully with 200 status
- Created comprehensive Docker configuration with docker-compose.yml and environment templates
- Added debugging tools (docker-debug.sh) for Linux server troubleshooting
- Docker containers now start successfully across all server environments including Linux

**2025-08-05**: ✅ **CASE NOTE SYSTEM FULLY OPERATIONAL** - Resolved all case note submission and display issues:
- Fixed "Completed by" loading issue in case note cards with proper fullName property usage
- Updated PDF export to include staff's full name in header section
- Resolved TypeScript errors in CaseNoteCard component  
- Verified submit button functionality - working correctly with proper validation
- Enhanced case note creation with comprehensive debugging and error handling
All case note functionality works correctly including creation, display, and PDF export.

**2025-08-05**: ✅ **INCIDENT SYSTEM FULLY RESOLVED** - Completed comprehensive fix of all incident reporting issues:
- Fixed data corruption bug where description field was overwritten with staff response descriptions
- Fixed incident closure duplicate key constraint errors with proper existence checks  
- Fixed status synchronization between database and UI with proper cache invalidation
- Enhanced error handling with user-friendly messages for already-closed incidents
- Added comprehensive logging for incident closure debugging
All incident functionality now works correctly with proper status updates from "Open" to "Closed".

**2025-08-01**: ✅ **CRITICAL SECURITY FIX** - Fixed authentication vulnerability where SupportWorkers bypassed shift-based access control on subsequent logins. Implemented comprehensive cache clearing, user re-verification, and enhanced audit logging to prevent unauthorized client data access.

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