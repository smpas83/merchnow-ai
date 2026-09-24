# MerchNow
#
# Field merchandising / retail execution marketplace and operating platform.
#
# Surfaces:
# - Mobile app (merchandiser / field worker) — @merchnow/mobile
# - Web app (customer / brand / retailer + admin / operations) — @merchnow/web
# - Backend API — @merchnow/backend
# - Shared types / schemas / clients — @merchnow/shared
# - Database schema + migrations — @merchnow/db
#
# Architecture: Expo (React Native + expo-router for web) + Node.js/TypeScript
# backend + tRPC + SQLite (Drizzle ORM) + Redis.
#
# Independent product. KASH integration contract exists but KASH is not the
# database and is not modified as part of MerchNow development.
