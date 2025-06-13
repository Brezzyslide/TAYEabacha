# CareConnect - Multi-Tenant Care Management System

A comprehensive healthcare facility management platform built with React, TypeScript, Express.js, and PostgreSQL. Features role-based access control, GPS-verified shift logging, dynamic forms, and real-time analytics.

## 🏥 Features

### Core Functionality
- **Multi-tenant architecture** - Support for multiple healthcare facilities
- **Role-based access control** - Admin, staff, and viewer permissions
- **Secure authentication** - Session-based auth with encrypted passwords
- **Client management** - Complete CRUD operations for patient records
- **Staff management** - Team member tracking and role assignment

### Advanced Features
- **GPS-verified shift logging** - Location-based staff check-in/check-out
- **Dynamic form builder** - Custom assessment and intake forms
- **Real-time dashboard** - Live statistics and activity monitoring
- **Activity logging** - Comprehensive audit trails
- **Data export** - CSV export for compliance and reporting
- **Responsive design** - Mobile-friendly interface with dark mode

## 🛠 Technology Stack

### Frontend
- **React 18** - Modern component-based UI
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible components
- **TanStack Query** - Data fetching and caching
- **Wouter** - Lightweight routing
- **React Hook Form** - Form management with validation

### Backend
- **Express.js** - Node.js web framework
- **TypeScript** - End-to-end type safety
- **Passport.js** - Authentication middleware
- **Express Session** - Session management
- **Drizzle ORM** - Type-safe database operations

### Database & Infrastructure
- **PostgreSQL** - Robust relational database
- **Neon/Serverless** - Scalable database hosting
- **Vite** - Fast build tool and dev server

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database
- Modern web browser with geolocation support

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd care-management-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Database configuration
   DATABASE_URL=your_postgresql_connection_string
   
   # Session security
   SESSION_SECRET=your_secure_session_secret
   ```

4. **Push database schema**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Open http://localhost:5000 in your browser
   - Create an account to get started

## 📋 Usage Guide

### Getting Started
1. **Register an account** - Use the registration form to create your profile
2. **Set up your facility** - Default tenant is provided for demo purposes
3. **Add clients** - Start by adding client profiles with care levels
4. **Manage staff** - Add team members with appropriate roles
5. **Track shifts** - Use GPS-verified shift logging for accurate time tracking

### Key Workflows

#### Client Management
- Navigate to "Clients" to add new client profiles
- Include essential information: contact details, care level, emergency contacts
- Edit or deactivate clients as needed
- View client history and associated forms

#### Shift Logging
- Go to "Shift Logging" to start tracking work hours
- Enable location services for GPS verification
- Specify building and floor information
- End shifts when work is complete

#### Form Creation (Admin only)
- Access "Forms" to create custom assessment templates
- Use pre-built templates or create custom forms
- Track form submissions and completion rates
- Export form data for analysis

#### Data Export
- Visit "Export Data" to download CSV reports
- Available exports: client data, shift records, form submissions
- Maintain compliance with audit trail exports

## 🏗 Architecture

### Database Schema
```
Tenants (Healthcare Facilities)
├── Users (Staff Members)
├── Clients (Patients/Residents)
├── Form Templates (Assessment Forms)
├── Form Submissions (Completed Forms)
├── Shifts (Work Sessions)
└── Activity Logs (Audit Trail)
```

### API Endpoints
- `POST /api/register` - User registration
- `POST /api/login` - User authentication
- `GET /api/clients` - Retrieve client list
- `POST /api/shifts/start` - Begin shift with GPS
- `GET /api/dashboard/stats` - Dashboard metrics
- `GET /api/export/clients` - Export client data

### Security Features
- Password hashing with scrypt
- Session-based authentication
- Tenant isolation for data security
- Role-based route protection
- GPS verification for shift authenticity

## 🔧 Development

### Project Structure
```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and configuration
├── server/                 # Express.js backend
│   ├── auth.ts            # Authentication logic
│   ├── routes.ts          # API route handlers
│   ├── storage.ts         # Database operations
│   └── db.ts              # Database connection
├── shared/                # Shared types and schemas
│   └── schema.ts          # Drizzle database schema
└── package.json           # Dependencies and scripts
```

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:push` - Push schema changes to database
- `npm run db:studio` - Open Drizzle Studio (database GUI)

### Adding New Features
1. Define database schema in `shared/schema.ts`
2. Update storage interface in `server/storage.ts`
3. Add API routes in `server/routes.ts`
4. Create frontend components in `client/src/`
5. Add routing in `client/src/App.tsx`

## 🚀 Deployment

### Environment Setup
- Set `NODE_ENV=production`
- Configure secure session secrets
- Set up production PostgreSQL database
- Enable HTTPS for secure cookie transmission

### Recommended Platforms
- **Vercel** - Frontend and API deployment
- **Railway** - Full-stack deployment
- **Render** - Complete application hosting
- **Neon** - PostgreSQL database hosting

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Maintain type safety across the stack
- Write descriptive commit messages
- Add proper error handling
- Include appropriate logging

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `docs/` folder
- Review the API documentation in `server/routes.ts`

## 🙏 Acknowledgments

- Built with modern React and TypeScript
- UI components from shadcn/ui
- Database operations with Drizzle ORM
- Authentication via Passport.js
- Styling with Tailwind CSS

---

**CareConnect** - Streamlining healthcare facility management with modern technology.