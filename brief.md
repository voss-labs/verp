# VOSS Auth Brief

## Purpose

VOSS Auth will be the central identity provider for VOSS web products. A student creates one VOSS account and uses it to authenticate with VERP and vboard. Each product continues to own its own data, roles, permissions, and sessions.

VOSS Auth will not authenticate vask users. Vask's SSH fingerprint identity and anonymity model must remain independent.

## MVP

The first release must provide:

- registration restricted to verified `@vit.edu.in` email addresses;
- email and password login;
- email verification and password recovery;
- OAuth 2.1/OpenID Connect authorization for trusted VOSS applications;
- separate first-party sessions in VERP and vboard;
- account and session management;
- a minimal identity administration console;
- an audit trail for privileged identity operations;
- one controlled process for bootstrapping the first super-admin.

The MVP does not include social login, public OAuth client registration, shared cross-subdomain cookies, infrastructure management, product-role management, or a cross-product data dashboard.

## Stack

- React 19
- Vite
- TanStack Router for browser routing
- Hono for server and API routing
- Cloudflare Workers for deployment
- Better Auth
- Better Auth OAuth 2.1 Provider, JWT, and Admin plugins
- Drizzle ORM
- Neon PostgreSQL
- Resend for transactional authentication email
- Tailwind CSS and shadcn/ui
- Zod
- Vitest

Vite builds the browser application. Hono is the trusted server boundary that holds secrets, mounts Better Auth, accesses Neon, and exposes privileged server endpoints. OAuth, password hashing, sessions, cookies, and token security will not be implemented manually.

## Deployment Shape

The complete service will run on one origin:

```text
https://accounts.vosslabs.org
```

```text
React + Vite
    -> same-origin HTTP
Hono on Cloudflare Workers
    -> Better Auth
    -> Drizzle
    -> Neon PostgreSQL
```

The initial server routes are:

```text
/api/auth/*   Better Auth and OAuth/OIDC endpoints
/api/admin/*  privileged identity operations
/api/health   service health check
/*            Vite-built React application
```

Keeping the UI and server on one origin avoids cross-origin session and CORS complexity.

## Repository Boundary

VOSS Auth will live in its own `voss-auth` repository. This isolates authentication secrets, schema migrations, deployments, and review permissions from product repositories.

```text
voss-auth/
├── src/
│   ├── client/
│   │   ├── routes/
│   │   ├── components/
│   │   ├── auth-client.ts
│   │   └── main.tsx
│   ├── server/
│   │   ├── index.ts
│   │   ├── auth.ts
│   │   ├── permissions.ts
│   │   ├── email.ts
│   │   └── routes/
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── migrations/
│   └── shared/
│       └── validation.ts
├── tests/
├── vite.config.ts
├── wrangler.jsonc
├── drizzle.config.ts
└── package.json
```

## Database Ownership

Create one Neon organisation named `VOSS Labs` with separate projects:

```text
VOSS Labs
├── voss-auth
├── verp
└── vboard
```

The `voss-auth` project stores only identity data such as users, credentials, sessions, verification records, OAuth clients, grants, and signing metadata. It does not store marks, student records, events, communities, or product permissions.

VERP and vboard never query the auth database. Each product stores the central OIDC subject as a unique external identity reference in its own database. Cross-database foreign keys are not used.

Each project has isolated production, development, and preview branches. Production credentials are available only to production deployments and the controlled migration workflow. Contributors do not receive production credentials.

## Authentication Flow

```text
1. A user opens VERP or vboard.
2. The product has no local session and redirects to VOSS Auth.
3. The user registers or signs in at accounts.vosslabs.org.
4. VOSS Auth verifies the institutional email.
5. VOSS Auth returns an authorization code.
6. The product exchanges the code server-side using PKCE.
7. The product validates the issuer, audience, signature, state, and nonce.
8. The product creates its own secure local session.
9. The product loads its local profile and permissions using the OIDC subject.
```

Initial scopes are limited to:

```text
openid
profile
email
```

Academic and community permissions are never embedded as the source of truth in identity tokens.

## Roles and Trust Boundaries

Central identity roles:

- `user`: manages their own identity and sessions;
- `identity_admin`: searches users, resends verification, revokes sessions, and disables compromised accounts;
- `super_admin`: performs identity-admin operations, assigns central roles, and manages trusted OAuth clients.

These roles do not grant access inside VERP or vboard.

Product roles remain local:

```text
VERP:   student, faculty, TR, academic_admin
vboard: student, community_manager, site_admin
```

The first super-admin is created through a privileged local bootstrap command after the account has registered and verified its email. The command operates by immutable user ID, refuses unsafe repetition, and records an audit event. It is not exposed as an HTTP endpoint.

Super-admin accounts require strong MFA or passkeys. A second super-admin is added only for organisational recovery and uses a separate account and credentials.

## Minimal Administration Console

The identity console will support:

- user search;
- verification and account-status inspection;
- session listing and revocation;
- account disabling and re-enabling;
- verification-email retry;
- privileged-action audit history;
- central role assignment restricted to super-admins.

It will not expose SQL execution, database editing, infrastructure secrets, academic data, event data, user impersonation, or arbitrary password setting. Trusted OAuth clients are configuration-as-code in the MVP.

## Organisational Ownership

`admin@vosslabs.org` will be created through Cloudflare Email Routing for notifications and public contact. It will not be used as a shared human login.

Neon, Cloudflare, GitHub, and deployment access use individual accounts with MFA. Harshal begins as administrator, and one proven Core Maintainer eventually receives independent recovery-level access. Credentials are never shared.

Infrastructure recovery must include a durable external address that does not depend on the college email system or the `vosslabs.org` domain.

## Implementation Sequence

1. Create the `voss-auth` repository and baseline tooling.
2. Create the `VOSS Labs` Neon organisation and `voss-auth` project.
3. Deploy the Vite and Hono shell to `accounts.vosslabs.org`.
4. Configure Better Auth, institutional email verification, Resend, and reviewed migrations.
5. Add OAuth 2.1/OIDC provider support and register VERP as the first trusted client.
6. Implement local sessions and identity linking in VERP.
7. Add the account pages, bootstrap process, minimal admin console, audit log, and automated tests.
8. Validate registration, verification, login, logout, recovery, revocation, and failure paths.
9. Register vboard only after the complete VERP authentication flow is stable.

VERP is the reference integration. VOSS Auth is not considered ready until VERP can complete the entire flow without shared cookies, direct auth-database access, or manual account linking.
