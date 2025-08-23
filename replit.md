# Overview

This is a service request management system built with a full-stack TypeScript architecture. The application allows users to create, track, and manage service requests for products, with features for adding comments, file attachments, and status tracking. It provides a dashboard for viewing metrics and managing requests through different workflow stages (new, inspection, service, received, completed).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client uses React with TypeScript and is built using Vite for fast development and building. The UI is constructed with shadcn/ui components based on Radix UI primitives, providing a consistent design system with Tailwind CSS for styling. The application uses wouter for client-side routing and TanStack Query for server state management and API calls. Forms are handled with react-hook-form and zod for validation.

## Backend Architecture
The server is an Express.js application with TypeScript that provides a REST API. It implements a simple in-memory storage system with an interface pattern (`IStorage`) that could be easily swapped for a database implementation. The API provides endpoints for service request CRUD operations, search functionality, comments, and metrics.

## Database & ORM
The project is configured to use Drizzle ORM with PostgreSQL (via Neon Database serverless). Database schemas are defined in a shared directory and include tables for service requests and comments. Migration management is handled through Drizzle Kit. Currently, the application uses in-memory storage but is architected to easily transition to the configured database.

## File Upload & Storage
The application includes a comprehensive object storage system integrated with Google Cloud Storage through Replit's sidecar service. It features an ACL (Access Control List) system for managing file permissions and access groups. The frontend provides an `ObjectUploader` component built on Uppy for handling file uploads with features like progress tracking and file management.

## Authentication & Security
While no authentication system is currently implemented in the active code, the object storage system includes a framework for ACL-based access control that could be integrated with user authentication in the future.

## Styling & UI Framework
The application uses a custom design system built on top of shadcn/ui components with Tailwind CSS. The styling includes CSS custom properties for theming support and uses the "new-york" style variant. Component aliases are configured for clean imports throughout the application.

# External Dependencies

## Database Services
- **Neon Database**: PostgreSQL serverless database configured through `@neondatabase/serverless`
- **Drizzle ORM**: Type-safe database toolkit with PostgreSQL dialect for schema management and queries

## UI & Component Libraries
- **Radix UI**: Comprehensive collection of low-level UI primitives for accessible component building
- **shadcn/ui**: Pre-built component library based on Radix UI primitives
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development

## File Upload & Storage
- **Google Cloud Storage**: Object storage service accessed through Replit's sidecar authentication
- **Uppy**: File upload library providing dashboard interface and progress tracking

## State Management & API
- **TanStack Query**: Server state management library for API calls, caching, and synchronization
- **React Hook Form**: Form state management with validation integration
- **Zod**: TypeScript-first schema validation library

## Development & Build Tools
- **Vite**: Fast build tool and development server with TypeScript support
- **ESBuild**: Fast JavaScript bundler used for production builds
- **Replit Plugins**: Development tools including error overlay and cartographer for enhanced development experience

## Utilities & Helpers
- **date-fns**: Date manipulation and formatting library
- **clsx & tailwind-merge**: Utility libraries for conditional CSS class management
- **nanoid**: Compact URL-safe unique ID generator