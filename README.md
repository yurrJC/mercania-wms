# Mercania WMS

A custom inventory management system (WMS) for second-hand media stores, modeled on World of Books / ThriftBooks workflows.

## 🎯 Project Overview

Mercania WMS streamlines the workflow from book intake to sale:
1. **Scan** → Auto metadata fetch (ISBN)
2. **Assign** → Internal ID (ULID)
3. **Print** → Label with barcode
4. **Shelve** → Assign location
5. **List** → Create eBay listings
6. **Track** → Monitor sales and inventory

## 🏗️ Architecture

- **Backend**: Node.js + Express + Prisma ORM + PostgreSQL
- **Frontend**: Next.js (TypeScript) admin dashboard
- **Database**: PostgreSQL with Docker
- **Package Manager**: pnpm
- **Build System**: Turbo (monorepo)

## 📁 Project Structure

```
mercania-wms/
├── apps/
│   ├── mercania-api/     # Express backend API
│   └── mercania-admin/   # Next.js admin dashboard
├── zpl/                  # ZPL label templates
├── docker-compose.yml    # PostgreSQL setup
├── init.sql             # Database schema
└── package.json         # Root monorepo config
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm 9+
- Docker & Docker Compose

### Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo>
   cd mercania-wms
   npm install
   ```

2. **Start the database:**
   ```bash
   pnpm db:up
   ```

3. **Start development servers:**
   ```bash
   pnpm dev
   ```

4. **Access the applications:**
   - API: http://localhost:3001
   - Admin Dashboard: http://localhost:3000

## 🗄️ Database Schema

### Core Tables

- **`isbn_master`**: Book metadata (title, author, publisher)
- **`items`**: Individual book copies with Internal IDs
- **`item_status_history`**: Track all status changes
- **`listings`**: Sales listings (eBay, etc.)
- **`orders`**: Customer orders
- **`order_lines`**: Order line items

### Key Concepts

- **Internal ID**: Unique ULID for each book copy (immutable)
- **ISBN**: Metadata lookup only (not used for picking)
- **Status Flow**: INTAKE → STORED → LISTED → SOLD
- **Location**: Mutable shelf location (e.g., B05-6044)

## 🏷️ Label Printing

ZPL template (`zpl/mercania_item_label.zpl`) includes:
- Internal ID (large text)
- Code128 barcode of Internal ID
- Intake date
- Brand text ("MERCANIA")

## 📊 API Endpoints

### Core Operations

- `POST /intake` - Create new item from ISBN
- `POST /items/:id/putaway` - Assign shelf location
- `POST /items/:id/list` - Create sales listing
- `POST /items/:id/status` - Update item status
- `GET /reports/listed-today` - Daily listing report

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start all development servers
- `npm run build` - Build all applications
- `npm run lint` - Run linting across all apps
- `npm run db:up` - Start PostgreSQL
- `npm run db:down` - Stop PostgreSQL
- `npm run db:reset` - Reset database (destructive)

### Adding New Features

1. **Backend**: Add routes in `apps/mercania-api/src/routes/`
2. **Frontend**: Add pages in `apps/mercania-admin/src/app/`
3. **Database**: Update schema in `init.sql` and Prisma models

## 🔧 Configuration

### Environment Variables

Create `.env.local` files in each app directory:

**API (.env.local):**
```env
DATABASE_URL="postgresql://mercania:mercania123@localhost:5432/mercania_wms"
PORT=3001
```

**Admin (.env.local):**
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## 📈 Workflow Examples

### Book Intake
1. Scan ISBN → Auto-fetch metadata
2. Enter condition and cost
3. System generates Internal ID
4. Print label with barcode
5. Status: INTAKE

### Putaway
1. Scan Internal ID barcode
2. Enter shelf location
3. Status: STORED

### Listing
1. Select item by Internal ID
2. Set price and channel
3. Create listing
4. Status: LISTED

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is proprietary software for Mercania Media Store.

---

**Built with ❤️ for efficient book inventory management**
