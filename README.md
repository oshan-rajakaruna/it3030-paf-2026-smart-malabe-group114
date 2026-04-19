<!--
README QUICK GUIDE
- Frontend-only base UI for the Smart Campus Operations Hub assignment
- Built to help multiple teammates work in parallel without stepping on shared files
- Mock data and placeholder flows are separated from reusable UI and layout code
-->

# Smart Campus Operations Hub

Production-inspired React + Vite frontend skeleton for the **IT3030 PAF 2026** assignment. This repository focuses on the **client web application base UI** first, with reusable components, route layout, mock data, theme tokens, and collaboration-friendly structure ready for later Spring Boot API integration.

## Stack

- React 19 + Vite
- React Router
- Context API for theme and mock authentication state
- Plain CSS Modules with shared design tokens

## Run Locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Project Structure

```text
src/
  assets/        Brand assets and SVG marks
  components/    Reusable UI, navigation, auth wrappers
  context/       Theme and auth providers
  data/          Mock datasets for facilities, bookings, tickets, notifications, users
  hooks/         Lightweight shared hooks
  layouts/       App shell layout
  pages/         Route-level pages
  routes/        Router configuration
  styles/        Global styles and theme tokens
  utils/         Shared constants, formatters, status helpers
```

## Collaboration Notes

- Keep route pages focused on composition, not shared logic.
- Put shared UI changes in `src/components/ui/` only when the change is truly reusable.
- Add new API calls behind dedicated service files later instead of embedding fetch logic inside page components.
- Preserve `src/utils/constants.js` as the single source of truth for roles, statuses, filters, and navigation items.

## Suggested Team Ownership

- Member 1: `FacilitiesPage`, `BookingsPage`, `data/facilities.js`, `data/bookings.js`
- Member 2: `TicketsPage`, attachment-ready UX, `data/tickets.js`
- Member 3: `NotificationsPage`, `SettingsPage`, theme and preference enhancements
- Member 4: `AdminPage`, auth/OAuth integration, protected routes, backend service wiring

Shared files to coordinate carefully:

- `src/utils/constants.js`
- `src/routes/AppRouter.jsx`
- `src/layouts/AppLayout.jsx`
- `src/components/navigation/Topbar.jsx`
- `src/styles/tokens.css`

## Backend Integration Plan

Later, connect this UI to the Spring Boot REST API by introducing:

- `src/services/` for module-based API clients
- `src/lib/httpClient.js` for token-aware requests
- DTO mapping helpers between API payloads and UI models
- Route-level loading and error states backed by real async calls

## Contributors

- Oshan Rajakaruna
- Pulmi Vihansa
- Sanugi Silva
- Nadeeja Weerasinghe
