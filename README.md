# DailyBrew ☕

DailyBrew is an offline-capable Progressive Web Application (PWA) designed for tracking daily eatery, tea, coffee, and pantry expenses. It offers instant local-first storage, detailed monthly analytics, budgeting, receipt storage, and seamless import/export with Excel spreadsheets.

## ✨ Features

- **Local-First & Offline Ready:** Built on IndexedDB with complete offline support and PWA caching.
- **Fast Expense Logging:** Quick-add items with preset catalog rates, quantities, and optional receipt photo attachments.
- **Monthly Analytics & Trends:** Category donut charts, daily spending trends, budget progress tracking, and month-over-month comparisons.
- **Excel & CSV Import/Export:** Import historical sheets and export formatted reports directly to `.xlsx` or `.csv`.
- **Month Close & Print Ready:** Audit monthly totals, lock closed periods, and generate clean print-friendly reports.
- **Mobile-Responsive UI:** Polished with Tailwind CSS v4, Lucide icons, and fluid responsive design for phones, tablets, and desktops.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/)
- npm or bun package manager

### Installation

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

### Production Build

```bash
# Typecheck and build for production
npm run build

# Preview production build locally
npm run preview
```

### Running Tests

```bash
# Unit & integration tests
npm run test

# End-to-end tests
npm run test:e2e
```

## 🛠 Tech Stack

- **Framework:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS v4 + Framer Motion
- **Storage:** IndexedDB (`idb`) + Supabase SQL migrations
- **PWA:** `vite-plugin-pwa` + Workbox
- **Charts:** Recharts
- **Spreadsheets:** SheetJS (`xlsx`)

## 📄 License

MIT
