"# Invoice Studio

A modern, full-stack invoice management application built with Node.js, Express, React, and SQLite/PostgreSQL/MySQL.

## Features

- **Client Management** - Add, edit, and organize clients
- **Time Tracking** - Log billable hours with break time tracking
- **Invoice Generation** - Create professional invoices with automatic calculations
- **Email Verification** - Secure account registration with email verification
- **Password Reset** - Forgot password functionality with secure reset tokens
- **User Authentication** - Secure session-based authentication
- **Multi-database Support** - SQLite (default), PostgreSQL, or MySQL
- **Business Settings** - Customize business details, payment terms, GST/VAT settings
- **Responsive UI** - Clean, modern interface that works on desktop and mobile

## Tech Stack

- **Backend**: Node.js, Express, Knex.js
- **Frontend**: React 18, React Router 6
- **Database**: SQLite (default), PostgreSQL, MySQL
- **Authentication**: Session-based with secure cookies, scrypt password hashing
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd invoice-generator
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

This will start both the backend server (port 5175) and frontend dev server (port 5173).

### Production Build

```bash
npm run build
npm start
```

## Configuration

### Database Configuration

The application supports three database types. Configuration is stored in `data/database.json`.

**SQLite (Default)**:
```json
{
  "type": "sqlite",
  "filename": "data/invoice.db"
}
```

**PostgreSQL**:
```json
{
  "type": "postgres",
  "host": "localhost",
  "port": 5432,
  "user": "your_user",
  "password": "your_password",
  "database": "invoice_db"
}
```

**MySQL**:
```json
{
  "type": "mysql",
  "host": "localhost",
  "port": 3306,
  "user": "your_user",
  "password": "your_password",
  "database": "invoice_db"
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5175 |
| `APP_URL` | Base URL for email links | `http://localhost:5173` |
| `REQUIRE_EMAIL_VERIFICATION` | Enable/disable email verification | `true` |

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user
- `GET /api/auth/status` - Check if any users exist
- `GET /api/auth/verify-email?token=` - Verify email address
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Clients

- `GET /api/clients` - List all clients
- `POST /api/clients` - Create client
- `GET /api/clients/:id` - Get client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Time Entries

- `GET /api/time-entries` - List time entries (with filters)
- `POST /api/time-entries` - Create time entry
- `PUT /api/time-entries/:id` - Update time entry
- `DELETE /api/time-entries/:id` - Delete time entry

### Invoices

- `GET /api/invoices` - List invoices (with filters)
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get invoice
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice
- `POST /api/invoices/:id/send` - Mark invoice as sent
- `POST /api/invoices/:id/pay` - Mark invoice as paid

### Settings

- `GET /api/settings` - Get business settings
- `PUT /api/settings` - Update business settings

## Project Structure

```
invoice-generator/
├── server/                 # Backend code
│   ├── db.js              # Database configuration & schema
│   ├── auth.js            # Authentication utilities
│   ├── routes/            # API route handlers
│   │   ├── auth.js        # Auth endpoints
│   │   ├── clients.js     # Client endpoints
│   │   ├── time-entries.js # Time entry endpoints
│   │   ├── invoices.js    # Invoice endpoints
│   │   └── settings.js    # Settings endpoints
│   └── index.js           # Express server entry point
├── src/                   # Frontend code
│   ├── components/        # Reusable React components
│   ├── pages/             # Page components
│   ├── api.js             # API client
│   ├── auth.jsx           # Auth context
│   ├── App.jsx            # Main app component
│   └── main.jsx           # Entry point
├── public/                # Static assets
├── data/                  # Database & config files
└── package.json
```

## Database Schema

- **users** - User accounts with email verification status
- **sessions** - Active user sessions
- **email_verifications** - Email verification tokens
- **password_reset_tokens** - Password reset tokens
- **clients** - Client information
- **time_entries** - Billable time entries
- **invoices** - Invoice records
- **invoice_items** - Line items for invoices
- **settings** - Business configuration

## Security Features

- Passwords hashed with scrypt (CPU-intensive KDF)
- Secure, HttpOnly session cookies
- CSRF protection via SameSite=Lax
- Timing-safe password comparison
- Token expiration for verification/reset links
- Session invalidation on password reset

## License

MIT License - feel free to use this for your own projects!
"