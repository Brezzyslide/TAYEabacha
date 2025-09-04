# CareConnect - Multi-Tenant Care Management System

## Overview
CareConnect is a comprehensive, multi-tenant healthcare facility management platform designed to streamline care operations. It provides role-based access control, GPS-verified shift logging, dynamic forms, and real-time analytics while ensuring strict data isolation between tenants. The system aims to enhance efficiency in care management and has significant market potential as a robust solution for healthcare facilities.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
**September 4, 2025:**
- ✅ **Critical Timesheet Data Persistence Fixed**: Resolved issue where timesheet history appeared to disappear after login/logout. Root cause was overly restrictive status filtering that only showed `['approved', 'rejected', 'paid']` timesheets. Fixed to display ALL timesheet statuses for complete legal compliance and data transparency.
- ✅ **Approved Shift PDF Export Fixed**: Resolved non-functional PDF button in timesheet history by adding missing `apiRequest` import. PDF generation now works correctly with company branding and comprehensive timesheet details.
- ✅ **Shift Duplication Issue Resolved**: Fixed multiple creation paths in NewShiftModal component that were causing duplicate shifts. Implemented proper state management for clash detection flow and cleanup logic to prevent simultaneous creation paths.

**September 3, 2025:**
- ✅ **Recurring Shift Delete Options**: Added "Delete Future Shifts" and "Delete Entire Series" functionality to recurring shift edit modal with proper backend DELETE endpoint at `/api/shifts/series/:seriesId`
- ✅ **Recurring Shift Time Issue Fixed**: Resolved time display inconsistencies by synchronizing both actual timestamps and template time fields when editing recurring shifts
- ✅ **Enhanced User Interface**: Added clear confirmation dialogs, loading states, and explanations for all delete operations with proper permission checking
- ✅ **Time Clash Detection System Fully Operational**: Comprehensive time clash detection working correctly for both create and edit operations. Root cause identified and resolved - system was creating zero-duration shifts that couldn't conflict. Added validation to prevent invalid time ranges. System properly detects staff conflicts (tested with 4 staff conflicts detected), shows warning dialogs, and allows admin override when necessary. Both NewShiftModal and EditShiftModal fully functional with proper async handling.

**August 28, 2025:**
- ✅ **ViewIncidentModal Date Bug Fixed**: Resolved "Invalid time value" errors in incident management module by adding safe date formatting helper `formatSafeDate()` and updating property mappings to match API response structure
- ✅ **TypeScript Interface Updates**: Fixed property access patterns - updated from nested `report` structure to direct property access, corrected field names (`clientFirstName/clientLastName` → `clientName`, `staffFullName` → `reporterName`, `details` → `notes`)
- ✅ **Authentication & Security Verified**: JWT_SECRET and PASSWORD_PEPPER properly configured, client access restrictions working correctly (SupportWorkers can only see assigned client data)

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
-   **Enhanced Security & Compliance:** Role-based access control restricts compliance module to Admin and Program Coordinator roles only, with both frontend route protection and backend API endpoint security. Digital signature system includes auto-fetching client names, comprehensive authenticity verification, and "sign on behalf" functionality with required name/role fields. **Third-party signing system with shareable links, access code protection, and external signature collection that integrates back into tenant systems (August 2025).**
-   **Automated Timesheet System:** Australian payroll-compliant auto-timesheet system with ScHADS pay scales, employment type separation, and leave accrual tracking. **Complete legal compliance ensuring ALL timesheet statuses (draft, submitted, approved, rejected, paid) are permanently retained and visible for audit purposes.**
-   **GPS Location Tracking:** For shift check-in/check-out with human-readable address display.
-   **AI Integration:** Used for generating care plan content, with comprehensive client data integration and pronoun consistency.
-   **Development Focus:** Completely purged of all production-related infrastructure. Recently removed: AWS debugging systems, production configuration files (production.config.js, productionConfig.ts), Vercel deployment setup (vercel.json), production optimization hooks (useProductionOptimizations.ts), enhanced fetch utilities (enhancedFetch.ts), AWS compatibility code in authentication, and all production environment detection logic. System operates purely in development mode with no production dependencies or references.

## External Dependencies
-   **Database:** PostgreSQL AWS RDS (`needscareai-dev.c3u4skeaqvx1.us-east-1.rds.amazonaws.com`) with SSL configuration (`@neondatabase/serverless` for serverless connections, `connect-pg-simple` for session store).
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