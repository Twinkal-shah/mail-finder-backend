# MailsFinder Dashboard

A modern email finder and verification dashboard built with Next.js 14, Supabase, and Stripe. Find and verify email addresses with ease while managing credits and billing.

## Features

- 🔍 **Email Finder**: Find email addresses by name and company domain
- 📊 **Bulk Email Finder**: Upload CSV/XLSX files for bulk email finding
- ✅ **Email Verification**: Verify single emails or bulk verification
- 💳 **Credit System**: Pay-per-use credit system with Stripe integration
- 📈 **Analytics**: Track search history and credit usage
- 🔐 **Authentication**: Secure user authentication with Supabase Auth
- 📱 **Responsive Design**: Modern UI with Tailwind CSS and shadcn/ui

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI, Lucide React
- **Backend**: Supabase (Database, Auth, RLS)
- **Payments**: Stripe (Credits, Billing)
- **File Processing**: XLSX, Papa Parse (CSV)
- **Deployment**: Vercel (recommended)

## Prerequisites

- Node.js 18+ and npm
- Supabase account
- Stripe account (for payments)
- Email Finder API (optional - uses mock data by default)
- Email Verifier API (optional - uses mock data by default)

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd mails-dashboard
npm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Email Finder API (Optional - uses mock data if not provided)
EMAIL_FINDER_API_URL=your_email_finder_api_url
EMAIL_FINDER_API_KEY=your_email_finder_api_key

# Email Verifier API (Optional - uses mock data if not provided)
EMAIL_VERIFIER_API_URL=your_email_verifier_api_url
EMAIL_VERIFIER_API_KEY=your_email_verifier_api_key

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MARKETING_URL=https://your-marketing-site.com
```

### 3. Database Setup

1. Create a new Supabase project
2. Run the SQL migration script in your Supabase SQL editor:

```bash
# Copy the contents of supabase-migration.sql and run it in Supabase SQL Editor
```

The migration will create:
- `profiles` table for user data
- `credit_transactions` table for credit history
- `searches` table for search history
- RPC functions for credit management
- Row Level Security (RLS) policies
- Automatic user profile creation trigger

### 4. Stripe Setup

1. Create a Stripe account and get your API keys
2. Create products and prices in Stripe Dashboard:
   - 100 Credits - $10
   - 500 Credits - $40
   - 1000 Credits - $70
3. Set up webhook endpoint: `https://your-domain.com/api/webhooks/stripe`
4. Configure webhook events: `checkout.session.completed`

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── find/            # Email finder page
│   │   ├── bulk-finder/     # Bulk email finder page
│   │   ├── verify/          # Email verification page
│   │   └── credits/         # Credits & billing page
│   ├── api/                 # API routes
│   │   └── webhooks/        # Stripe webhooks
│   ├── globals.css          # Global styles
│   └── layout.tsx           # Root layout
├── components/
│   ├── ui/                  # shadcn/ui components
│   └── dashboard-layout.tsx # Dashboard layout component
├── lib/
│   ├── services/            # External API integrations
│   │   ├── email-finder.ts  # Email finder service
│   │   └── email-verifier.ts # Email verifier service
│   ├── auth.ts              # Authentication utilities
│   ├── supabase.ts          # Supabase client configuration
│   └── utils.ts             # Utility functions
└── middleware.ts            # Next.js middleware for auth
```

## API Integration

### Email Finder Service

The application supports external email finder APIs. If no API is configured, it uses mock data for demonstration.

**Expected API Format:**
```json
{
  "email": "john.doe@company.com",
  "confidence": 95,
  "status": "found"
}
```

### Email Verifier Service

Similarly, email verification can use external APIs or fall back to mock data.

**Expected API Format:**
```json
{
  "email": "john.doe@company.com",
  "status": "valid",
  "confidence": 95,
  "deliverable": true,
  "disposable": false,
  "role_account": false,
  "reason": "Valid email address"
}
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-side) |
| `EMAIL_FINDER_API_URL` | ❌ | External email finder API URL |
| `EMAIL_FINDER_API_KEY` | ❌ | Email finder API authentication key |
| `EMAIL_VERIFIER_API_URL` | ❌ | External email verifier API URL |
| `EMAIL_VERIFIER_API_KEY` | ❌ | Email verifier API authentication key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe publishable key |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe webhook signing secret |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your application URL |
| `NEXT_PUBLIC_MARKETING_URL` | ❌ | Marketing site URL for redirects |

## Features in Detail

### Credit System

- Users start with 10 free credits
- 1 credit = 1 email find or verification
- Credits are only deducted for successful operations
- Purchase additional credits via Stripe

### Authentication

- Powered by Supabase Auth
- Supports email/password authentication
- Protected routes with middleware
- Automatic profile creation

### File Processing

- Support for CSV and XLSX files
- Bulk operations with progress tracking
- Export results to CSV
- Client-side file validation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support, please open an issue on GitHub or contact [your-email@domain.com].

---

**Note**: This application uses mock data by default for email finding and verification. To use real APIs, configure the appropriate environment variables and ensure your API endpoints match the expected format.
