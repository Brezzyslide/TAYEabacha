# CareConnect - Multi-Tenant Care Management System

## Overview

CareConnect is a comprehensive healthcare facility management platform built with modern web technologies. It provides a multi-tenant architecture supporting multiple healthcare facilities with role-based access control, GPS-verified shift logging, dynamic forms, and real-time analytics. The system is designed to streamline care management operations while maintaining strict data isolation between tenants.

## System Architecture

### Frontend Architecture
- **React 18** with TypeScript for type-safe component development
- **Tailwind CSS** with shadcn/ui component library for consistent, accessible UI
- **TanStack Query** for efficient data fetching, caching, and synchronization
- **Wouter** for lightweight client-side routing
- **React Hook Form** with Zod validation for robust form management
- **Vite** as the build tool for fast development and optimized production builds

### Backend Architecture
- **Express.js** server with TypeScript for type safety across the stack
- **Passport.js** with Local Strategy for session-based authentication
- **Express Session** with PostgreSQL session store for scalable session management
- **Drizzle ORM** for type-safe database operations and migrations
- **RESTful API** design with comprehensive error handling and logging

### Database Design
- **PostgreSQL** as the primary database with multi-tenant data isolation
- **Company-based tenant separation** ensuring data privacy between organizations
- **Role-based access control** with five permission levels (SupportWorker, TeamLeader, Coordinator, Admin, ConsoleManager)
- **Comprehensive schema** covering clients, staff, shifts, forms, observations, medications, incidents, and more

## Key Components

### Authentication & Authorization
- Session-based authentication with secure password hashing using scrypt
- Multi-level role system with granular permissions
- Company-level data isolation for true multi-tenancy
- Permission-based UI rendering and API access control

### Core Modules
1. **Client Management** - CRUD operations for patient records with NDIS integration
2. **Staff Management** - Team member tracking with role assignments and availability
3. **Shift Management** - GPS-verified check-in/check-out with location tracking
4. **Dynamic Forms** - Custom assessment and intake forms with flexible field types
5. **Case Notes** - Documentation system for client interactions and care updates
6. **Medication Management** - Plans and administration tracking with photo documentation
7. **Incident Reporting** - Safety incident documentation and closure tracking
8. **Hourly Observations** - Regular client monitoring and documentation
9. **Workflow Dashboard** - Automated insights panel with manual task board for comprehensive workflow management
10. **Roles & Permissions** - Custom role creation with granular permission overrides and user assignment
11. **Staff Hour Allocation** - Budget management with analytics and shift enforcement
12. **Internal Messaging** - Staff communication system with role-based access

### Real-time Features
- Live dashboard with activity monitoring
- Real-time statistics and analytics
- Activity logging for comprehensive audit trails
- Responsive design with dark mode support

## Data Flow

### Client Request Flow
1. Client authenticates via session-based login
2. Role and tenant information validated on each request
3. API endpoints enforce permission-based access control
4. Database queries filtered by tenant and permission scope
5. Response data sanitized based on user permissions

### Database Operations
1. All operations scoped to user's tenant (except ConsoleManager)
2. Drizzle ORM provides type-safe query building
3. Automatic activity logging for audit compliance
4. Optimistic updates with TanStack Query for responsive UI

### Form Processing
1. Dynamic forms rendered from JSON schema
2. Client-side validation with Zod schemas
3. Server-side validation and sanitization
4. Automatic form submission tracking and audit logging

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless** - Serverless PostgreSQL connection
- **connect-pg-simple** - PostgreSQL session store
- **date-fns** - Date manipulation and formatting
- **drizzle-orm** - Type-safe ORM with PostgreSQL support
- **passport & passport-local** - Authentication middleware

### UI Dependencies
- **@radix-ui/** components - Accessible, unstyled UI primitives
- **@tanstack/react-query** - Data fetching and state management
- **lucide-react** - Icon library
- **tailwindcss** - Utility-first CSS framework

### Development Dependencies
- **TypeScript** - Type safety across frontend and backend
- **Vite** - Fast build tool with HMR
- **ESBuild** - Fast JavaScript bundler for production

## Deployment Strategy

### Environment Configuration
- **DATABASE_URL** - PostgreSQL connection string (required)
- **SESSION_SECRET** - Secure session encryption key (required)
- **NODE_ENV** - Environment mode (development/production)
- **PORT** - Server port (default: 5000)

### Supported Platforms
1. **Vercel** (Recommended) - Automatic deployments with GitHub integration
2. **Railway** - Simple deployment with built-in PostgreSQL
3. **Render** - Full-stack hosting with environment management
4. **Replit** - Development and testing environment

### Database Options
- **Neon** (Recommended) - Serverless PostgreSQL with automatic scaling
- **Supabase** - Open-source Firebase alternative with PostgreSQL
- **Railway PostgreSQL** - Managed database service
- **Any PostgreSQL provider** - Standard connection string support

### Build Process
1. Frontend builds to `dist/public` directory
2. Backend compiles to `dist/index.js` with ESBuild
3. Static assets served by Express in production
4. Database migrations applied via `npm run db:push`

## Changelog
- June 14, 2025. Initial setup
- June 14, 2025. Fixed shift editing functionality - resolved timestamp data type issue (Drizzle expects Date objects, not ISO strings)
- June 14, 2025. Implemented true calendar collapse functionality with Daily/Weekly/Fortnightly/Monthly view toggles that change grid structure rather than just filtering content
- June 14, 2025. Added Calendar view as default when opening Calendar tab instead of list view
- June 14, 2025. Created complete Staff Hour Allocation module with analytics dashboard, allocation management, and shift enforcement capabilities
- June 14, 2025. Updated SupportWorker permissions to allow medication administration record creation for assigned clients
- June 14, 2025. Built comprehensive Roles & Permissions management system with custom role creation, permission overrides, and user assignment capabilities
- June 14, 2025. Fixed custom role creation API - resolved parameter order issue and schema validation for optional fields
- June 14, 2025. Completed interactive Permission Matrix with clickable cells for direct permission overrides, enabling real-time role customization
- June 14, 2025. Created complete Workflow Dashboard module featuring Auto Insights Panel for automated system analysis and Manual Task Board with drag-and-drop functionality for comprehensive workflow management
- June 14, 2025. Built comprehensive NDIS Budget Management system with participant budget setup, automatic shift-to-budget deductions, pricing management, transaction tracking, and role-based permissions for budget oversight
- June 15, 2025. Completed comprehensive Case Note module with GPT-4o spell checking (2-check limit), shift auto-fetching, incident reporting toggle, medication administration tracking, enhanced database schema with caseNoteTags JSONB column, and fixed API endpoint synchronization between main dashboard and client profile views
- June 15, 2025. Cleaned up all client profile tabs by removing placeholder/demo content - overview, incidents, medications, schedules, observations, care-plans, and enhanced-medications tabs now display clean empty states ready for live data integration while preserving functional case notes implementation
- June 15, 2025. Fixed case notes filtering issue where all client profiles showed shared data - now properly filters by clientId parameter, ensuring data isolation between clients
- June 15, 2025. Performed database cleanup removing demo content - deleted 3 medication plans, 45 shift records, and 5 medication administration records while preserving 3 client profiles and 1 user-generated case note
- June 15, 2025. Fixed client creation form date validation by implementing z.coerce.date() in server schema to handle JSON date string serialization, replaced complex calendar picker with HTML date input for easier birth year selection (1920-current range), and enhanced all calendar components with year navigation toggles using double-chevron buttons for quick year jumping
- June 15, 2025. Fixed clientId routing inconsistencies by standardizing navigation to use route parameters (/support-work/client-profile/:clientId) instead of query parameters, updated ClientCard and clients.tsx navigation links to use client.id for proper route matching, and added proper error handling for missing clientId parameters
- June 15, 2025. Fixed missing clientId extraction in all client profile tabs by adding proper validation and error handling - each tab now checks for missing clientId and displays appropriate error states before attempting data queries, preventing 400 errors and ensuring robust data fetching across overview, incidents, medications, schedules, observations, care-plans, enhanced-medications, and case-notes-simple tabs
- June 15, 2025. Implemented comprehensive full month calendar view for client profile schedules tab with interactive month navigation, color-coded shift status indicators, clickable shift details, overflow handling for busy days, monthly summary statistics, and responsive design - replacing the previous list view with a visual calendar grid that displays all client shifts in traditional calendar format
- June 15, 2025. Enhanced observation system with scrollable form dialog, fixed database constraint issues for behaviour observations (notes column now nullable), synchronized API endpoints for proper data display, and added quick view buttons with modal dialogs to all observation cards - providing clean, readable display for both ADL and behaviour star chart assessments with enhanced star visualization
- June 15, 2025. Fixed medication plan creation API error by correcting parameter order in apiRequest function call and updated role permissions to include ConsoleManager access for medication plan endpoints, ensuring comprehensive medication management functionality across all administrative roles
- June 15, 2025. Implemented universal ConsoleManager permissions by updating requireRole middleware to automatically grant ConsoleManager access to all endpoints, establishing proper administrative hierarchy where ConsoleManager has unrestricted system access
- June 15, 2025. Completed medication management system fixes: resolved ConsoleManager permissions for medication plan creation, fixed date validation with z.coerce.date() and empty date field handling, enhanced client profile medications tab to display active plans with detailed information and Record buttons, updated medication administration form with auto-population of medication details (name, dosage, route, time of day) and automatic "administered by" field population with current user for complete compliance tracking
- June 15, 2025. Added comprehensive "Administered By" column to medication records display across all views - enhanced API to include administrator username information in medication records, updated Medication Dashboard and client profile medication tabs to show who administered each medication with user icon for improved accountability and audit trail compliance
- June 15, 2025. Completed full medication management system integration for client profiles - transferred complete medication dashboard functionality to client profile medication tab with proper company and client ID filtering, including overview statistics, medication plans display with full details, administration records with "Administered By" tracking, search and filter capabilities, and tabbed interface for comprehensive medication management within individual client profiles
- June 15, 2025. Fixed medication record data isolation by implementing client-specific API endpoints - updated RecordAdministrationModal to use `/api/clients/${clientId}/medication-records` for record creation and `/api/clients/${clientId}/medication-plans` for plan fetching, corrected HTTP method parameter order bug in apiRequest function calls, and ensured medication records are properly linked to specific clients with proper query invalidation for real-time updates across both client profile and main dashboard views
- June 15, 2025. Enhanced organizational medication dashboard with comprehensive compliance analytics - fixed "0 plans" display issue, implemented organizational-wide compliance overview with refused/missed/successful administration metrics, added dedicated Compliance Analytics tab with intelligent filtering (organizational-wide by default, client-specific when searching), synchronized analytics framework between main dashboard and client profile views for consistent medication compliance tracking across the platform
- June 15, 2025. Fixed medication analytics data mapping issue - corrected organizational dashboard to recognize actual database values ("administered", "missed", "refused") instead of incorrect values ("Given", "Refused", "Missed"), ensuring all existing medication records are properly reflected in compliance calculations across both client profile and organizational dashboards
- June 15, 2025. Fixed client profile schedules tab showing all organizational shifts instead of client-specific data - updated shifts API endpoint to properly filter by clientId parameter, ensuring schedules tab displays only shifts assigned to the specific client being viewed
- June 15, 2025. Completely resolved duplicate sidebar issue across all components - removed redundant Sidebar and Header imports from Dashboard, Support Work page, and ClientProfileDashboard components, ensuring all layout rendering is handled exclusively by the centralized ProtectedRoute component for consistent navigation experience throughout the entire application
- June 15, 2025. Enhanced logout button visibility by removing responsive hiding class, ensuring logout functionality is always visible in header navigation across all screen sizes for improved user experience
- June 15, 2025. Implemented horizontal scrolling for top navigation area with hidden scrollbars - added overflow-x-auto, flex-shrink-0 classes, and custom CSS utilities to enable smooth left/right scrolling on mobile and desktop while maintaining clean visual appearance
- June 15, 2025. Fixed missing header component in ProtectedRoute layout - restored Header import and positioning to ensure logout button, user initials, and navigation controls are visible across all authenticated pages
- June 15, 2025. Enhanced Staff Management module with comprehensive functionality - added "Create Staff" button with full form dialog for creating new staff members, implemented search functionality for staff directory with real-time filtering by username/email/role, improved role-based statistics display to properly count Admin and ConsoleManager roles, added proper null handling for email fields, and enhanced staff directory table with filtered data display and improved error handling
- June 15, 2025. Fixed critical staff creation API bug - corrected parameter order in apiRequest function call (method, url, data), resolved role permission case sensitivity issues preventing Workflow Dashboard access, added missing `/api/staff` endpoint for staff directory functionality, fixed User schema compatibility by using existing fullName field instead of firstName/lastName, and added DialogDescription for accessibility compliance in staff creation dialog
- June 15, 2025. Resolved "Add New Client" button missing issue for Admin users - fixed permission system company boundary enforcement logic that was incorrectly blocking Admin users from creating clients, ensuring Admin role with full company access permissions can properly create and manage clients across all company contexts without company ID mismatch restrictions
- June 15, 2025. Work in progress: Admin permission consistency issue - "Add New Client" button should appear consistently across all companies for Admin users but still experiencing issues with permission system logic, needs further investigation
- June 15, 2025. Fixed React hooks error in authentication flow - resolved "Rendered fewer hooks than expected" error by ensuring all hooks are called before any conditional returns in AuthPage component, eliminating login flow crashes
- June 15, 2025. Simplified authentication page by removing user registration functionality - removed registration form, tabs, and related code since user creation is handled through internal system, creating cleaner login-only interface

## User Preferences

Preferred communication style: Simple, everyday language.