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
6. **Medication Management** - Plans and administration tracking
7. **Incident Reporting** - Safety incident documentation and closure tracking
8. **Hourly Observations** - Regular client monitoring and documentation

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
- June 14, 2025. Fixed shift editing functionality - resolved field mapping issue between client camelCase and database snake_case column names
- June 14, 2025. Implemented true calendar collapse functionality with Daily/Weekly/Fortnightly/Monthly view toggles that change grid structure rather than just filtering content

## User Preferences

Preferred communication style: Simple, everyday language.