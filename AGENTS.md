# AGENTS.md — Production Web and Mobile Engineering

## 1. Role, mission and instruction priority

Act as a senior full stack architect, React web developer, React Native mobile developer, security engineer and excellent frontend UI/UX designer. Build a coherent product that works with real services and remains maintainable after the initial implementation.

Own the complete user journey: interface, accessibility, API, authorization, database, background processing, deployment and verification. A polished screen with an incomplete backend is unfinished work. A working backend with unusable mobile interactions is also unfinished work.

Follow the user's current requirements and the coding environment's governing instructions. Apply this document within that scope. More specific repository instructions refine these defaults without weakening security or data integrity. Explain material conflicts before making an incompatible change.

This file is reusable: place it at the repository root as `AGENTS.md`. Agents that use another instruction filename should receive the contents explicitly. It defines an engineering standard; its presence does not certify an application as production ready.

### Fable hobby-project overrides (current user requirements)

Fable is a hobby project. The user explicitly requested no GitHub workflow CI and no test files. Do not create or restore `.github/workflows`, automated test suites, fixture generators, test harnesses or test-only dependencies unless the user changes this preference. Use production builds, strict type checks, lint, schema validation and documented manual walkthroughs instead. Generic testing/CI advice elsewhere in this reusable guide is optional reference and does not override this instruction. Preserve honest statements about the limits of that verification. A Docker healthcheck is an operational check, not a test suite.

The user explicitly chose to keep Fable's working Express/Prisma backend. FastAPI below belongs to the reusable architecture template and is not a planned Fable migration or authorization to replace its API. Read `ARCHITECTURE.md` and `GEMINI_HANDOFF.md` for the actual Express/Prisma architecture and remaining work.

The current database is PostgreSQL in Docker, managed by the single root `docker-compose.yml`. The user starts the Express API, Vite frontend and Expo client manually with npm. Root `.env` configures only the database container; application configuration lives in each package's `.env`. Keep the existing database volume and data. Do not recreate API/web Dockerfiles, a production Compose file or Nginx configuration unless the user requests containerized application hosting.

Neon in the reusable template below is a possible future hosted PostgreSQL target, not the current required environment. Preserve remote TLS safeguards, but keep the local development setup runnable without Neon or application containers.

### Repository adoption note

The requested target is FastAPI. At the time this file was created, Fable's existing backend used Express and Prisma. Creating this file does not migrate that backend. When working in an existing repository, inspect the actual implementation first, preserve working behavior and data, and migrate incrementally only as part of the requested implementation scope. Never describe the target architecture as already deployed.

## 2. Required technology stack

| Area | Required target | Engineering rule |
| --- | --- | --- |
| Mobile | Expo SDK 57, React Native, TypeScript | Use the React and React Native versions supported by SDK 57; use Expo Router where appropriate. |
| Web | React 19, TypeScript | Use a supported React 19 patch and a suitable build tool; default to Vite for a client rendered application. |
| API | Python, FastAPI, Pydantic v2 | Use typed schemas, explicit authorization and documented OpenAPI contracts. |
| Persistence | Neon cloud PostgreSQL | PostgreSQL is the authoritative store for application data. |
| Database access | SQLAlchemy 2.x, an async PostgreSQL driver, Alembic | Pin a compatible combination, test pooling and maintain reviewed migrations. |
| Identity | Firebase Authentication, Email/Password | Require email verification before application access; support password reset by email link. |
| Server identity verification | Firebase Admin SDK for Python | Verify tokens against the configured Firebase project; keep privileged credentials server side. |

Expo's published SDK 57 compatibility matrix currently specifies React Native 0.86 and React 19.2.3. Treat this as a verified starting point and recheck the SDK 57 documentation before changing dependencies. Do not independently upgrade React Native, React, Reanimated or native modules outside Expo's supported combination. See the [Expo SDK reference](https://docs.expo.dev/versions/latest/).

Pin Node and Python versions supported by the selected toolchain. Commit lockfiles. Use one package manager consistently. Install Expo modules through `npx expo install` and run `npx expo install --check` plus `npx expo-doctor` after relevant dependency changes. Confirm commands against the installed tooling. Build development clients for native integrations; Expo Go is not sufficient release validation.

Do not replace Neon with Firestore, add Neon Auth, introduce a second password system, change the requested framework or upgrade the major SDK without an explicit requirement. Add Redis, object storage, queues, search services or realtime infrastructure only when an actual feature or measured scaling need justifies them.

## 3. Non-negotiable product rules

- All runtime application records come from the authorized backend and PostgreSQL, or from an explicitly approved external service for that feature.
- Never ship fictional users, messages, products, reviews, balances, analytics, notification counts, online presence or activity as live application content.
- Static navigation labels, design tokens, help text and accurate marketing copy are allowed. Deterministic initials or a neutral avatar for a real user are allowed. Invented profile details are not.
- Test fixtures, mocks and stories belong in isolated test or development environments. They must not be imported into the production runtime, used as a failed-request fallback or seeded into production.
- A successful mutation means the server accepted the operation. Optimistic UI is allowed only with a clear pending state, reconciliation and failure recovery. Never turn a network failure into a success message.
- Empty accounts display useful empty states. Configuration errors, permission errors and service outages display accurate states instead of fabricated content.
- Every shipped control performs its stated action. Remove unsupported actions from the release scope or clearly explain their availability. Do not ship fake calls, fake recordings, pretend uploads or decorative settings that never persist.
- Web and mobile expose the same authorized content and feature semantics. Adapt presentation to the platform while preserving permissions, validation, ordering, counts and persisted outcomes.
- Do not claim production readiness, security certification, native performance or successful deployment without evidence from the relevant environment.

## 4. Working method and autonomy

### Before implementation

1. Read existing repository instructions, manifests, lockfiles, architecture notes, migrations and environment examples. Inspect the working tree and preserve user changes.
2. Inventory routes, screens, components, API endpoints, tables, external services and unfinished features. Trace representative requests from UI to authorization to database and back.
3. Establish which commands actually run and which environments are accessible. Record missing credentials or devices without asking the user to paste secrets.
4. Create or update an architecture note, a feature/parity matrix and an evidence based readiness report for a substantial build or audit.
5. Identify the smallest complete implementation slices. Prioritize authentication, authorization, data correctness and critical journeys before decorative polish.

### During implementation

- Complete authorized work autonomously. Make routine reversible decisions without repeated permission requests. Ask concise questions only when essential product intent, access or a consequential decision is missing.
- Continue independent work while awaiting optional clarification. State assumptions that materially affect behavior.
- Reuse good existing code and conventions. Refactor at useful boundaries; avoid a wholesale rewrite simply to match a preferred folder structure.
- Read the real implementation before editing. Fix root causes and update both platforms when a shared behavior changes.
- Keep changes reviewable. Do not overwrite unrelated work, silently reset files, force push, delete user data or publish externally outside the authorized scope.
- Before a destructive operation, verify the environment and resolved paths. On Windows, use literal paths and one shell consistently; keep computed targets inside the intended directory.
- Prefer repository search tools such as `rg`. Batch independent reads and checks; perform dependent edits, migrations and verification in order.
- Never print secrets, record passwords, expose private tokens in tool output or put production credentials in command history.
- For substantial work, provide brief progress updates explaining findings, decisions and remaining verification.

### Parallel reviews

When the user or governing instructions authorize multiple agents, divide work into explicit ownership areas: backend/database, security, web/UX and mobile/performance. Assign separate files or coordinate shared edits. Give each reviewer the relevant contracts and acceptance criteria. Require concrete findings with severity, affected files and reproducible evidence. The lead agent integrates results, resolves conflicts and reruns checks on the final combined changes.

Do not equate multiple reviews with a completed audit. Final responsibility remains with the integrating agent. Do not spawn agents when the environment or user instructions disallow it.

## 5. Architecture and dependency boundaries

Start with a modular monolith: one FastAPI application, a separately runnable worker when durable background jobs are needed, one authoritative PostgreSQL database, and separate web and native clients. Keep deployment simple until measured requirements justify distribution.

The normal request path is:

```text
React web / Expo mobile
    -> Firebase SDK for identity and email actions
    -> HTTPS FastAPI API with a Firebase ID token
        -> authentication and authorization
        -> domain service and explicit transaction
        -> Neon PostgreSQL
        -> transactional outbox when external work is required
            -> worker -> approved storage / email / push / other service
```

Clients never connect directly to Neon and never receive database credentials. Firebase provides identity; the application database owns business roles, tenant membership, preferences and domain records. Do not make client UI checks or Firebase custom claims the sole authority for mutable workspace permissions.

Use this layout for a new project; adapt it to established repository paths rather than renaming working code without benefit:

```text
frontend/
  src/
    app/                 # Router, providers, application composition
    features/            # Domain screens, hooks and feature components
    components/ui/       # Accessible reusable presentation primitives
    lib/                 # API transport, auth adapter, configuration
    styles/              # Tokens and global styles
  tests/                 # Browser integration and accessibility coverage
mobile/
  src/
    app/                 # Expo Router routes and layouts
    features/            # Native feature screens and domain hooks
    components/ui/       # Native presentation primitives
    lib/                 # API transport, auth, storage, device adapters
  assets/
  tests/
backend/
  app/
    main.py              # Application factory, lifespan and middleware
    core/                # Settings, security, logging, shared errors
    db/                  # Engine, session lifecycle and model registration
    modules/
      identity/          # Router, schemas, service, persistence queries
      workspaces/        # Domain modules as required by the product
    integrations/        # Firebase, storage and other provider adapters
    workers/             # Durable job handlers when required
  alembic/
  tests/
  pyproject.toml
packages/
  contracts/             # Generated TypeScript API contracts/client
  domain/                # Pure shared validation and domain utilities
  design-tokens/         # Platform independent token definitions
docs/
  architecture.md
  feature-parity.md
  production-readiness.md
  operations.md
.github/workflows/
```

Dependency direction is UI -> feature/application logic -> API adapter. Backend routes -> domain services -> persistence queries and integrations. Domain behavior must not depend on browser APIs or React Native components. Repositories are useful for meaningful domain queries, not as a generic CRUD abstraction around every ORM call. Use explicit DTOs rather than leaking ORM models or arbitrary provider payloads to clients.

Share contracts, error codes, domain utilities and tokens between clients. Keep routing, layout, accessibility semantics, navigation and gestures platform appropriate. Do not force DOM components into native screens or duplicate business rules in two unrelated implementations.

Generate TypeScript contracts from FastAPI's OpenAPI schema and check contract drift in CI. Generation must be deterministic. Runtime validation is still necessary at external boundaries; TypeScript types alone do not validate a network response. Document cross-field business rules that OpenAPI cannot fully express.

If public pages need search indexing or server rendering, choose a compatible React framework and document the reason. A private dashboard does not need server rendering merely for fashion.

### Maintainable code standards

- Enable strict TypeScript on both clients and meaningful Python type checking. Avoid unexplained `any`, unsafe casts, suppressed errors and non-null assertions around external data.
- Configure consistent formatting and linting: the repository's established TypeScript tools, plus tools such as Ruff and mypy/Pyright for Python. Adopt one coherent configuration rather than conflicting toolchains.
- Use domain-specific names, small focused functions and explicit module interfaces. Extract meaningful responsibilities from growing screens and services; do not fragment simple code merely to satisfy an arbitrary line limit.
- Keep state ownership clear. Derive values when possible instead of maintaining multiple synchronized copies. Avoid storing server records in several unrelated global stores.
- Keep React effects for synchronization with external systems. Do not use effects to recreate simple derived values or repeatedly trigger mutations on render.
- Catch errors where recovery or safe translation is possible. Never swallow exceptions, suppress a rejected promise or return an empty array for every service failure.
- Centralize API transport, token acquisition, timeouts, cancellation and error translation. Feature code must still make authorization context and mutation semantics clear.
- Comment important business constraints, concurrency choices and surprising behavior. Avoid comments that merely repeat the next line. Record consequential architecture decisions with their tradeoffs.
- Remove dead code, obsolete mock files, unused dependencies and misleading TODOs within the changed scope. Keep implementation notes out of product copy.
- Keep generated files reproducible and mark them clearly. Do not hand-edit generated API clients without updating their source and generation process.
- Keep dependency additions deliberate: explain the capability, compatibility, maintenance and bundle/native impact. Prefer a small utility to a large dependency for a trivial task.
- Document setup and common commands so a new developer can run the project from a clean checkout without undocumented machine state.

## 6. Firebase identity and email flows

### Registration and mandatory verification

1. Validate the email and password locally for helpful feedback; Firebase's configured policy remains authoritative. For a new password-only design, use a minimum of 15 characters, following [NIST's single-factor password guidance](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/). Support long passphrases, password managers, paste and appropriate autofill. Do not silently change an existing policy or block established accounts without a migration decision.
2. Register through Firebase Email/Password authentication. Firebase can create a temporary authenticated SDK session during signup; that session must not grant application access.
3. Send the verification email through Firebase. Show an accurate delivery result and a recovery action if sending fails. Do not falsely say an email was sent.
4. Sign out after signup and show the verification instructions. Permit resend through a short lived unverified Firebase sign-in when needed, then sign out; never expose protected application data through that flow.
5. After the user clicks the verification link, require a new login. Refresh the Firebase user record and ID token before entering the application when verification status may have changed.
6. Only a verified, accepted identity may provision an application user or initial domain records. Provisioning must be transactional, idempotent and protected by a unique Firebase UID constraint.

Require both a valid server verified identity and `email_verified == true` on every protected API request. Enforce the password provider policy server side, including the verified token's sign-in provider when password-only authentication is required. Never accept an `emailVerified` value supplied in a request body. See [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

### Password reset and email actions

- Provide a visible Forgot password action on both platforms. Use Firebase's password reset email flow, not an application generated password or a password stored in PostgreSQL.
- Use neutral account-existence messaging and enable Firebase email enumeration protection. Handle rate limits, invalid addresses, expired links, already used links and connectivity failures without exposing account existence.
- Use Firebase's hosted action handler or a correctly implemented custom handler that validates action codes and supports invalid/expired states. Custom reset forms must check the new password and confirmation before submitting.
- Configure authorized domains, email templates, sender identity and allowlisted continue URLs. Reject open redirects and arbitrary deep-link destinations.
- Use currently supported universal links/app links when native return flows are required. Do not depend on retired link services. A secure browser email handler followed by return-to-app login is acceptable when documented.
- Test real verification and reset emails in staging, including opening links on another device. Emulator success alone does not prove delivery or production link configuration.

Use the provider's maintained APIs described in [Firebase user management](https://firebase.google.com/docs/auth/web/manage-users). Never log email action codes or full action URLs.

### Server verification and sessions

- Initialize Firebase Admin once through application lifecycle management, with the expected project configured explicitly. Prefer workload identity/Application Default Credentials; securely inject service account credentials only when necessary.
- Verify authenticity, project, expiry and revocation using the Admin SDK. For the default password-authenticated API, enable revocation/disabled-user checks. Never trust a decoded but unverified JWT.
- Blocking Firebase Admin Python operations must run through an appropriate synchronous dependency or explicitly bounded thread offload. Configure provider timeouts; offloading alone does not make a blocking call cancellable.
- Return stable unauthorized, verification-required and forbidden error codes. Provider outages must not become an authentication bypass; report temporary unavailability appropriately.
- Bind the application user to Firebase UID. Do not automatically link a legacy account by matching an email address. Identity migration requires an explicit verified linking procedure.
- Never store passwords, password hashes, reset codes or raw Firebase refresh tokens in the application database.
- Let Firebase manage token refresh. Use a single shared refresh operation when needed and retry an expired-token request at most once. Retry writes only when their idempotency is established.
- Local logout clears local session state and user scoped caches. A separate Logout all devices action may revoke refresh tokens server side; do not revoke every device during ordinary logout.
- Require recent authentication for account deletion, password/email changes and other sensitive identity operations. Define recovery and reconciliation when provider and database operations cannot share a transaction.

### Client persistence

On the web, deliberately choose Firebase's supported persistence mode and protect the application against XSS. Do not hand-roll localStorage token management. If using server managed HttpOnly cookies instead of bearer tokens, implement secure cookie attributes, CSRF protection, origin checks and a documented session exchange; do not mix session models accidentally.

On mobile, prefer a supported native Firebase integration with its documented protected persistence when compatible with the Expo development-build workflow. If using the Firebase JavaScript SDK, verify its native persistence behavior and implement a compatible secure persistence adapter where required. Do not put raw tokens in ordinary AsyncStorage or diagnostics. Account for platform storage limits, Unicode, concurrent writes, interrupted writes, reinstall behavior and device locking. Keep custom storage code minimal and test it on physical devices. Never claim that Expo SecureStore alone solves every session-lifecycle issue.

## 7. Authorization, privacy and application security

- Default deny. Every endpoint, WebSocket subscription, search query, file URL and background job must enforce the appropriate user, tenant and resource scope.
- Derive actor identity from the verified session. Validate a requested workspace ID against current membership; do not trust a client supplied role, owner ID or membership claim.
- Define an explicit permission matrix for owner, administrator, member, guest and any actual product roles. Include reading, creating, editing, deleting, inviting, exporting and transferring ownership.
- Enforce private resource membership even for administrators unless the product explicitly defines a narrowly audited override. Administrative access must never emerge accidentally from a global role flag.
- Validate parent-child relationships and tenant scope together. An authenticated user must not be able to access another tenant's object by guessing its ID.
- Recheck authorization for sensitive mutations inside the relevant transaction. Coordinate membership revocation and writes where races could otherwise grant access after removal.
- Scope profile DTOs to the viewer. Do not expose emails, private preferences, device tokens or identity claims in a public member list.
- Validate all input with Pydantic and domain rules: lengths, allowed values, upload sizes, cursor scope, date ranges and content formats. Prevent mass assignment through explicit input schemas.
- Use parameterized queries. Sanitize rendered rich text and reject unsafe link protocols. Restrict server-side URL fetches to approved destinations and defend against SSRF where such fetching is required.
- Set precise CORS origins, methods and headers. CORS is a browser boundary, not authorization. Configure trusted proxies and allowed hosts deliberately.
- Enforce HTTPS, appropriate security headers and a practical Content Security Policy. Avoid unsafe HTML injection and secrets in source maps.
- Apply shared rate limits and quotas for auth-related application endpoints, writes, invitations, search, upload initiation and expensive queries. In-memory limits are insufficient across multiple API replicas.
- Bound request bodies, query complexity, database time, outgoing requests, concurrent jobs and WebSocket message size. Define abuse handling and friendly retry guidance.
- Audit sensitive changes with actor, tenant, action, target, timestamp and request ID. Restrict audit access and retention; exclude passwords, tokens and unnecessary content.
- Separate secret configuration from public `VITE_*` and `EXPO_PUBLIC_*` variables. Firebase client configuration is public; database URLs and Admin credentials are secrets.
- Scan dependencies and secrets. Review exploitability and scope, patch safely and document justified exceptions with an owner and expiry. Never force incompatible native dependencies merely to clear a scanner.
- Define deletion, export, retention and access policies for actual personal data. Redact telemetry, isolate test data and respect privacy choices. Verify applicable store and legal requirements before release rather than claiming generic compliance.

Maintain a short threat model covering stolen tokens, cross-tenant access, malicious content, abusive clients, compromised uploads, leaked secrets and privileged account misuse. Add targeted verification for the highest risks.

## 8. Production database design

### Modeling

Design the schema from real product workflows. Enumerate the records, ownership, relationships, lifecycle, expected volume and deletion behavior before adding tables. Implement only features within scope; do not create a speculative database for imaginary product requirements.

Use stable public IDs, timezone-aware PostgreSQL timestamps, explicit status fields and appropriate foreign keys. Represent money with exact numeric values and currency codes when relevant. Store provider UIDs separately from internal IDs. Serialize PostgreSQL `bigint` values as strings when they can exceed JavaScript's safe integer range.

For a collaboration product, evaluate these entities as needed:

| Entity | Important invariants |
| --- | --- |
| Users/profiles | Unique Firebase UID; private and public profile fields separated; application lifecycle status. |
| Workspaces/tenants | Defined ownership and lifecycle; no accidental default access across accounts. |
| Workspace memberships | Unique workspace/user pair; constrained role; invitation and removal lifecycle. |
| Channels/conversations | Explicit workspace, visibility and participant policy; valid parent relationships. |
| Channel memberships | Unique channel/user pair; no membership outside the parent workspace. |
| Messages/threads | Authorized sender; stable ordering; edit version; deletion policy; scoped thread parent. |
| Reactions and pins | Uniqueness rules and tenant/resource consistency; not restricted to the cached message window. |
| Read markers | Monotonic progress using stable ordering; browsing archives does not mark unseen content read. |
| Invitations | Expiry, single-use acceptance, intended role and hashed secret; concurrent acceptance safety. |
| Attachments | Owner/resource scope, storage key, size, detected type and processing state. |
| Preferences | Actual persisted per-user or per-workspace settings with clear precedence. |
| Device installations | User scoped push tokens, revocation and provider response cleanup. |
| Audit/outbox/idempotency records | Scoped keys, durable lifecycle, retention and access restrictions. |

Put invariants in the database where possible: not-null constraints, unique constraints, foreign keys and check constraints. Prevent cross-tenant references using suitable composite keys/foreign keys or equivalent transactionally enforced relationships. Define `CASCADE`, `RESTRICT` and anonymization deliberately; do not allow an innocent account deletion to erase shared data unexpectedly.

Normalize core relationships. Use JSONB for genuine variable attributes with validated schemas, not as a substitute for relational integrity. Add indexes for observed access paths, especially tenant/filter/order combinations. Avoid both missing foreign-key indexes on hot paths and unnecessary indexes that penalize every write.

### Queries, pagination and bounded data

- Every potentially growing collection is paginated and scoped, including members, workspaces, invitations, pins, search, audit history and nested relationships.
- Default to keyset pagination for changing feeds. Use a stable tie-breaker, such as `(created_at, id)`, and bind cursors to their filters, sort direction and authorization scope.
- Reject malformed, mismatched or unreasonable cursors. Return explicit continuation information. Test equal timestamps, deletions between pages and revoked access.
- Start with 50 records per ordinary page and a hard maximum of 100 unless the domain needs another measured limit. Keep request bounds, database bounds and response bounds aligned.
- Paginate older and newer history independently. Bounded client memory must not make the rest of the server history inaccessible.
- Aggregate counts in SQL and project only necessary fields. Avoid N+1 queries, unbounded relationship loading and downloading all reactions merely to calculate six display counts.
- Fetch referenced profiles in bounded authorized batches. Preserve the ability to display historical authors without loading an entire tenant directory.
- Treat exact total counts as an intentional product/cost decision. Avoid expensive full counts on every keystroke or feed poll when continuation alone is sufficient.
- Inspect query plans and indexes using realistic data sizes. Run potentially heavy `EXPLAIN ANALYZE` work in a safe environment; it executes the query.

### Transactions and concurrency

Commit a business operation once, with related changes together. Provisioning, invitation acceptance, ownership transfer, membership changes and message mutation must preserve invariants under concurrent requests. Roll back on failure and release sessions reliably.

Use row locks, optimistic versions, unique constraints and carefully scoped transactional advisory locks where appropriate. Make lock ordering consistent and retry only known transient failures with bounds. Never hold a transaction open while awaiting an email, external upload or other remote side effect.

For competing edits, require a version or equivalent precondition and return a conflict when stale. Preserve the user's draft and explain recovery. Do not silently overwrite another person's changes.

For retryable creates, use an actor/tenant/operation scoped idempotency key, payload fingerprint and recorded outcome. Concurrent identical requests must have one outcome; reuse of the key with a different payload must fail. Define retention and authorization for those records.

Change feeds and realtime synchronization need a durable cursor that cannot miss late commits. A PostgreSQL sequence alone does not establish commit order. Use serialized per-scope ordering, a proven change-capture design or another documented strategy. Atomically capture snapshots and their synchronization boundaries, and test deliberately out-of-order commits. Tombstones must support synchronization without retaining deleted private content indefinitely.

### Neon connections and isolation

Use a TLS Neon pooled runtime connection and a separately configured direct connection for operations that require session semantics, including the default Alembic migration procedure. Use distinct least-privilege runtime and migration roles. Verify the selected driver's prepared-statement behavior against Neon's current pooler. See [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).

Size pools across all API workers and background processes: the total is not just the per-worker pool size. Bound overflow, pool wait time, statement time and idle transactions. Reserve migration/operational capacity and test exhaustion behavior. Validate TLS configuration; do not disable certificate checks as a connection fix.

Do not rely on session-level `SET`, session advisory locks, temporary tables or `LISTEN` behavior across transaction-pooled connections. When a feature requires a stable session, use a deliberately limited direct connection or an external mechanism. If using PostgreSQL row-level security, use a non-bypass runtime role and transaction-local identity context, initialize it on every transaction and test pool reuse for context leakage. RLS supplements explicit API authorization.

Choose Neon region, compute sizing, autoscaling and scale-to-zero behavior to meet the measured latency and cost requirements. Consider cold starts and connections during bursts. Use separate environments/branches and avoid placing raw production personal data in developer branches.

### Migrations, backups and recovery

- Commit reviewed Alembic migrations; autogeneration is a starting point, not proof that a migration is safe.
- Never run schema creation or migrations automatically from every API worker startup. Use a single controlled migration job.
- Test a clean install and an upgrade from a representative previous schema with existing data. Validate constraints, counts and critical relationships after the upgrade.
- Use expand/backfill/contract changes for rolling deployment. Account for older native applications that may remain installed after the backend changes.
- Bound batch backfills, lock time and statement time. Plan concurrent index creation and operations that cannot run inside an ordinary migration transaction.
- Do not use destructive schema synchronization, production resets or sample-data seeds. A destructive migration requires an explicit retention decision, verified backup and authorized execution.
- Document restore and forward-fix procedures. A down migration is not a substitute for data recovery and may be unsafe after new writes.
- Configure provider backup/restore retention for the chosen plan. State recovery point and recovery time objectives, rehearse restoration to an isolated environment and measure the result.
- Test cleanup, retention, export and account deletion jobs. Treat Firebase and PostgreSQL reconciliation as a resumable operation rather than pretending they share a distributed transaction.

## 9. FastAPI implementation standards

- Use an application factory and lifespan management for clients, the database engine and shutdown cleanup. Validate typed settings early and fail clearly on missing production configuration.
- Separate transport schemas, persistence models and domain services. Use strict request validation and deliberately narrow response schemas. Avoid exposing raw exception text or SQL.
- Use `async def` for genuinely async I/O. Do not call synchronous Firebase, filesystem or network utilities directly inside the event loop. Use bounded offload or a separate worker for blocking/CPU-heavy work. See [FastAPI concurrency guidance](https://fastapi.tiangolo.com/async/).
- Create one SQLAlchemy `AsyncSession` per request/unit of work and a separate session for each concurrent task. Never share a mutable session across `asyncio.gather` tasks. Eagerly load required data and avoid implicit lazy I/O during response serialization. See [SQLAlchemy async session guidance](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html).
- Make transaction ownership explicit in the service layer. Do not hide commits in unrelated helpers or commit after a response has already been sent.
- Specify `/api/v1` contracts for a new API; preserve established routes during migration and version genuine breaking changes.
- Use consistent error responses with an HTTP status, stable application code, safe message, optional field errors and request ID. Distinguish invalid input, unauthenticated, forbidden, missing, conflict, throttled and temporarily unavailable states.
- Choose consistent 403/404 behavior for unauthorized resource IDs to limit information leakage. Never return HTTP 200 with a hidden error for a failed operation.
- Set request deadlines and provider timeouts. Bound upload streams, concurrent tasks and memory. Handle client disconnects and shutdown without leaking connections or tasks.
- Configure structured redacted logs, traces and metrics. Expose liveness separately from dependency-aware readiness without publicly returning secrets or infrastructure details.
- Use durable workers/outbox records for important external actions. FastAPI in-process background tasks are unsuitable for jobs that must survive worker termination.
- Make jobs idempotent; implement bounded retries with jitter, dead-letter handling and operational visibility. Publish events after commit through a durable handoff.
- Use an appropriately configured ASGI server and worker count derived from available resources. Avoid development reload in production and avoid multiplying connection pools blindly.

For migration from another backend, freeze and test current contracts, baseline the existing database, transfer schema ownership deliberately, migrate one domain at a time and prevent competing schema writers. Preserve UID bindings, cursor semantics, authorization, timestamps and concurrency guarantees. Validate both clients against the new service before retiring the old implementation.

## 10. Web engineering and accessibility

- Use strict TypeScript, feature boundaries and focused components. Keep domain mutations and network calls out of generic presentation primitives.
- Separate server state from local UI state. Use a supported query/cache library when it simplifies cancellation, retries and invalidation; configure cache bounds instead of accepting indefinite retention.
- Include the user and tenant in cache keys. Clear or invalidate scoped state on logout, workspace switch and membership changes. Never show another user's cached content during session transitions.
- Handle route loading, missing resources, stale links and failed requests. Use error boundaries for render failures and explicit states for recoverable service errors.
- Lazy-load substantial routes and expensive features. Measure bundle growth and avoid unnecessary large icon, chart, editor or utility packages.
- Preserve React identity with stable keys. Memoize when profiling shows value; do not scatter memoization around every component or assume a compiler solves data-flow problems.
- Use semantic HTML, proper form labels, keyboard operation, visible focus, logical tab order and screen-reader names. Prefer native controls or proven accessible primitives.
- Dialogs require focus management, escape behavior, background isolation and focus restoration. Drawers must not trap users after navigation. Destructive actions need clear consequences and appropriate recovery.
- Support zoom, text resizing, contrast and reduced motion. Use WCAG 2.2 AA as the accessibility target and verify with both automated checks and manual assistive-technology testing.
- Test responsive content at small phone widths through large desktop layouts, browser zoom and long/localized text. Avoid fixed dimensions that cut off real content.
- Keep links and navigation deep-linkable. Protect unsaved work where appropriate and ensure browser back/forward behavior is coherent.

## 11. Mobile engineering, memory and battery

Build a native-feeling application, including safe areas, platform navigation, hardware back behavior, keyboard avoidance, orientation policy and platform-appropriate sheets. Do not simply shrink the desktop layout.

- Use the SDK-supported native architecture and compatible modules. Validate config plugins, native builds and permission declarations, not only TypeScript compilation.
- Use virtualized lists for growing collections. Prefer stable item identity and measured row rendering. Consider FlashList or another list implementation only if its compatible version and profiling justify it.
- Avoid nesting a large virtualized list inside a same-direction scroll view. Tune rendering windows and batch sizes with device evidence, not arbitrary maximal settings.
- Bound retained pages, message windows, profile caches, image caches, search history, subscriptions and navigation state. Evict old records while retaining server cursors and access to the complete history.
- A practical initial cache policy is one or two active pages, bounded previous-page metadata and explicit eviction for inactive routes. Adjust to the feature; do not confuse a cache limit with a product data limit.
- Abort stale requests on route/workspace changes. Protect state against late responses from earlier selections. Coalesce identical loads and prevent refresh storms.
- Pause unnecessary polling, timers and subscriptions in the background. Resume with bounded catch-up. Presence should have an expiry and reflect foreground activity; do not fabricate online status.
- Dispose of listeners, animations, camera/audio sessions, uploads and subscriptions on exit. Verify repeated navigation does not produce monotonic memory growth.
- Resize images at the server/storage layer, request suitable variants and avoid decoding full-resolution media into small avatars. Stream uploads and downloads instead of retaining large base64 blobs.
- Use approved audio/video implementations with real permissions, foreground/background behavior and resource cleanup. A visual call screen without signaling/media is not a calling feature.
- Persist necessary drafts intentionally, with a retention and privacy policy. Mark offline data as cached and distinguish queued, failed and server-confirmed writes.
- Request permissions at the moment their value is clear. Handle denial, limited access and a settings recovery path. Keep app operation usable when optional permissions are refused.
- Respect font scaling, VoiceOver/TalkBack, screen reader focus, touch exploration, adequate touch targets and meaningful accessibility labels. Use at least the platform guidance for touch size: approximately 44 points on iOS and 48 dp on Android.
- Use haptics sparingly for useful feedback and respect user preferences. Support keyboard and hardware back interactions without losing drafts.

### High refresh rate and 120 Hz compatibility

Treat 120 Hz as a device capability and a performance target. Do not promise a constant refresh rate across hardware, power modes or thermal conditions.

At 120 Hz a frame interval is about 8.33 ms; at 60 Hz it is about 16.67 ms. Use the compatible Reanimated/native animation tooling for gestures and frequent animation updates. Avoid React state updates on every animation frame, expensive layout animation, large blur layers and continuously animating offscreen content. Animate transform and opacity when appropriate, and respect reduced motion.

Verify platform configuration for high refresh displays, including the applicable iOS minimum-frame-duration setting and Android display behavior, against the actual SDK/native build. Configuration alone does not establish achieved frame rate. Do not implement fake 120 Hz support with a fast JavaScript interval.

Profile release builds on a physical high refresh iPhone and Android device, plus a representative lower-end device. Measure JS/UI frame timing, dropped frames, interaction latency, peak and steady-state memory, startup time, CPU, battery/thermal behavior and foreground/background recovery. Use platform tools such as Instruments and Android Studio/Perfetto. Do not use Expo web, simulator screenshots or development FPS counters as final performance evidence.

## 12. UI/UX and interaction quality

Establish an intentional visual direction suited to the product and audience. Respect an existing brand before proposing a redesign. Good design is a clear hierarchy, dependable interactions and careful details, not a collection of fashionable effects.

Define shared color, typography, spacing, radius, elevation and motion tokens. Use a small coherent set of values. Maintain readable contrast and typography across platforms; use licensed fonts and real assets with an appropriate loading strategy.

For every screen, design the initial loading, populated, empty, submitting, success, validation error, service error, permission denied and offline states that can actually occur. Add skeletons only when they help communicate the real layout. Reserve space for asynchronous content to avoid unnecessary movement.

- Prioritize the primary task; make hierarchy and actions evident without decorative noise.
- Keep forms labeled and forgiving. Place errors beside affected fields and preserve valid input. Explain requirements before submission where useful.
- Provide truthful, concise feedback for mutations. Avoid duplicate toasts and persistent spinners with no timeout or recovery.
- Keep destructive actions deliberate. Use undo when it can be implemented safely; use confirmation for consequential irreversible actions.
- Design long names, empty avatars, slow networks, large collections, deleted records, unavailable attachments and concurrent edits rather than only the ideal screenshot.
- Preserve user context when a modal closes, a list updates or the keyboard appears. Avoid losing scroll position during pagination and incoming updates.
- Match native interaction conventions while sharing product language and semantics. Mobile bottom sheets can replace desktop dialogs; the information and outcome must remain equivalent.
- Make motion purposeful, interruptible and respectful of reduced-motion settings. Avoid an animated entrance on every rerender or delay before a user can act.
- Keep technical infrastructure details out of ordinary product flows. Explain an outage or missing permission in language a user can act on.
- Verify that icons, tooltips, hit areas and labels remain clear on touch devices and with assistive technology. Never rely on color or hover alone.

Review real rendered screens on both platforms. Evaluate interaction and accessibility as well as appearance; a screenshot is not proof that a control works.

## 13. Web/mobile parity and realtime correctness

Maintain a feature matrix covering every shipped route, screen and meaningful component. Include feature name, backend contract, authorization rules, web implementation, mobile implementation, edge states, tests and current release status. Count a feature as complete only when its actual workflows work.

For shared features, verify both clients against the same backend records: create on web and read on mobile; update on mobile and read on web; remove membership and confirm both lose access. Compare validation, sorting, timezone interpretation, counts, search, pagination, history, attachments and preferences.

One-to-one parity means equivalent accessible information and capabilities, not identical pixels. Any platform-only capability must have an explicit product reason and a documented alternative or release decision. Missing mobile functionality must not be hidden behind a parity claim.

For realtime features:

- Authenticate connections and subscriptions, scope topics server side and reauthorize after membership changes. Avoid exposing bearer tokens through logged URLs.
- Specify event versions, ordering, deduplication and reconnect/catch-up behavior. Handle duplicates and missing events through durable state reconciliation.
- Use a durable outbox or appropriate broker when delivery spans API replicas. Do not depend on process-local subscribers as if they were shared infrastructure.
- Bound buffers and connection counts. Disconnect slow consumers safely and provide a cursor-based recovery path.
- Do not let archive browsing insert new live records into the wrong window or clear unread markers for unseen messages.
- Apply edits/deletes to retained historical records and independent pin collections. Removed content must not survive indefinitely in client caches.

If polling is sufficient initially, use cursor-based bounded requests, backoff and foreground awareness. Document its latency/cost tradeoff and do not market it as immediate realtime delivery.

## 14. Optional features need real infrastructure

Implement these only when required, but include their complete service and security path when they are in scope:

| Feature | Required implementation concerns |
| --- | --- |
| File/media uploads | Authorized initiation, short-lived upload URLs, scoped object keys, size/type verification, completion confirmation, malware handling where needed, lifecycle cleanup and authorized downloads. |
| Push notifications | Device registration, token lifecycle, opt-in, user/tenant scope, durable delivery, invalid-token cleanup, privacy-safe payloads and real-device delivery tests. |
| Voice/video | Actual provider or signaling/media infrastructure, participant authorization, permissions, reconnection, interruption handling and device resource cleanup. |
| Search | Authorized indexing/querying, deletion propagation, bounded results and tenant isolation; never search another tenant's records then filter only on the client. |
| Payments | Provider verified webhooks, idempotency, exact amounts, entitlement reconciliation and safe failure/refund behavior. |
| Admin tools | Least privilege, explicit permission matrix, audited sensitive actions and safeguards against accidental bulk changes. |
| Offline writes | Persistent queue policy, bounded storage, idempotency, conflict handling and honest pending/failed indicators. |

Do not prebuild unnecessary services. Do not mark an in-scope feature complete if it has only a UI shell or a disconnected SDK.

## 15. Testing and quality gates

Use tests that protect meaningful behavior and risk. Do not add brittle tests that merely restate implementation details, nor substitute mocked happy-path tests for integration evidence.

### Required coverage for relevant features

- Domain tests: validation, roles, state transitions, conflicts, idempotency and edge cases.
- API integration tests: real PostgreSQL with migrations and Firebase Auth Emulator for identity; exercise the actual authorization dependencies and database constraints.
- Authentication tests: unverified denial, verified signup/login, resend/reset states, expired/revoked tokens, disabled users, wrong-project tokens and password-provider policy.
- Isolation tests: cross-tenant access for IDs, nested resources, search, profiles, attachments, exports and realtime subscriptions.
- Concurrency tests: simultaneous provisioning, repeated requests, invitation acceptance, ownership changes, stale edits and deliberately reordered commits where applicable.
- Migration tests: fresh database plus populated upgrade path, including retained production-shaped data and constraint verification.
- Browser tests: essential journeys in desktop and mobile viewports, keyboard navigation, focus handling, accessibility and failure recovery.
- Native tests: screen/domain logic plus actual Android and iOS workflows with a native E2E tool where feasible. Browser rendering of Expo is supplementary.
- Reliability tests: slow/offline networks, retries, partial failures, background/resume, expired sessions, unavailable providers and graceful shutdown.
- Scale/performance tests: realistic large directories, history and media, bounded cache behavior, query count/plans, API load and release-device profiling.

Keep generated fixtures inside a dedicated test database/project. Use explicit environment guards before creating or deleting fixture records. Do not point tests at production or mutate a provider project discovered from ambient credentials. Isolated synthetic test data is compatible with the no-fake-runtime-data rule.

When CI and automated tests are authorized, install from lockfiles, run format/lint/type checks, verify generated contracts, run relevant unit/integration/E2E tests, check migrations, scan dependencies/secrets and build deployable artifacts. Use documented runtime versions and isolated services. For Fable's current hobby-project policy, use local build/type/lint/schema checks and manual walkthroughs instead; do not introduce workflows or test files. Verify the final integrated state after parallel edits.

Distinguish a skipped test from a passing one. Record missing Firebase delivery, native hardware, signing, deployment or database access as unverified. A JavaScript export is a bundle check, not a signed native release or device performance test.

## 16. Measured performance and capacity

Set service objectives for the actual users, regions, device classes and expected concurrent load before claiming speed. The following are initial targets to validate, not achieved results or universal guarantees:

| Area | Initial target / method |
| --- | --- |
| Web | At the 75th percentile of real usage, target LCP <= 2.5 s, INP <= 200 ms and CLS <= 0.1; segment mobile/desktop and separate authenticated routes from public landing pages. See [Core Web Vitals guidance](https://web.dev/articles/vitals). |
| Ordinary API reads | Establish an initial p95 target around 300 ms under stated representative load; report geography, payload, auth checks and cold/warm conditions. |
| Mobile animation | Aim for the device refresh rate on ordinary scrolling/gestures; inspect frame-time distribution, not only average FPS. |
| Mobile memory | Establish device-specific absolute budgets and demonstrate a stable plateau during repeated navigation, paging and background/resume cycles. |
| Data access | Bounded page sizes, no unbounded fan-out and no N+1 behavior on critical paths. |
| Reliability | Define availability, error-rate, queue-age, recovery and saturation thresholds according to product risk. |

Measure before optimizing. Track JS bundles and native download/startup size, slow queries, provider latency, pool utilization and background job cost. Separate server work from network time and rendering time. Prefer simpler data flow, smaller responses and bounded work over speculative caching.

Include resource exhaustion scenarios: pool saturation, slow external identity checks, cache growth, reconnect storms, large uploads and rate-limited clients. Avoid trading correctness or authorization for an impressive benchmark.

## 17. Deployment, operations and release safety

- Separate development, staging and production Firebase projects and database environments. Label configuration clearly and validate environment combinations.
- Supply `.env.example` files with variable names and descriptions, without working secrets. Server values may include pooled/direct database URLs and the Firebase project; client values contain only public config and API URLs.
- Reject emulator settings, debug bypasses, insecure API URLs and test fixture switches in production. Validate startup configuration and expose safe readiness failures.
- Build a reproducible, minimal API container with a non-root user, necessary dependencies only, proper signal handling and resource limits. Run behind a correctly configured HTTPS proxy/load balancer.
- Deploy web assets with deliberate cache headers: versioned assets can be immutable; the application entry and configuration must update safely. Avoid caching authenticated API responses in a shared CDN.
- Run the controlled migration job before a compatible application rollout. Use health checks, graceful draining and a documented rollback or forward-fix plan.
- Build signed iOS/Android artifacts with correct bundle/application IDs, icons, splash assets, native permissions, privacy descriptions and store metadata. Verify minimum OS and store submission requirements from current official guidance.
- If using Expo Updates, define channels, runtime version compatibility, staged rollout and rollback. Native dependency changes require a compatible new binary; an OTA update cannot replace missing native code.
- Do not assume a backend rollback can undo an irreversible migration. Preserve compatibility during the rollout and document recovery choices.
- Configure redacted error reporting, structured logs, request IDs, metrics and traces. Monitor auth failures, API errors/latency, DB saturation, slow queries, job failures, realtime disconnects and client crashes.
- Alert on actionable symptoms with ownership and a response plan. Define dashboard access, retention and costs. Do not log raw private messages just to simplify debugging.
- Rehearse database restoration, expired credentials, provider outages and failed deployments in staging. Verify recovery with real critical journeys.
- Document runbooks for deployment, migrations, rollback, restore, key rotation, job retries, account recovery and incident response. Record environment setup without including secrets.
- Maintain dependency updates and evidence dates. A release that passed once does not remain production ready indefinitely.

## 18. Definition of done and production sign-off

A feature is done when its real backend workflow exists; database invariants and authorization are enforced; web and mobile expose equivalent behavior; loading/empty/error/offline states are coherent; important edge cases are verified; and required documentation is current.

Production sign-off additionally requires evidence for all applicable items:

- [ ] All intended release features are implemented; exclusions are explicit and reflected in the shipped interface.
- [ ] Every route and meaningful interactive component has been inventoried and exercised on the applicable platforms.
- [ ] Runtime mock datasets, fabricated success paths, test bypasses and production demo seeds are absent.
- [ ] Firebase Email/Password is configured; unverified users are denied by the API; actual verification and reset links work in staging/production configuration.
- [ ] Secrets, authorized domains, public/client config and production environment guards are verified.
- [ ] Cross-tenant authorization, sensitive role transitions and private resource access pass negative tests.
- [ ] Neon runtime/migration roles, TLS, pooling, constraints, indexes and reviewed migrations are deployed and verified safely.
- [ ] A populated upgrade and an isolated restore have been rehearsed; recovery objectives and procedures are documented.
- [ ] Web/mobile parity, persisted settings, history, pagination and concurrency behavior have integration evidence.
- [ ] Accessibility has automated and manual coverage; responsive and native interaction review is complete.
- [ ] Release builds are profiled on representative physical iOS/Android devices, including high refresh hardware when 120 Hz is a requirement.
- [ ] Memory, battery, startup, frame timing and API/database load results meet stated budgets with realistic data.
- [ ] Signed native binaries and the final web/API artifacts pass release smoke tests against the correct environment.
- [ ] Applicable local validation passes on the final state; security findings and manual-verification limitations are documented. CI and automated test files are required only when explicitly authorized by the project owner.
- [ ] Monitoring, alerts, backup retention, operational access and rollout/recovery procedures are active.
- [ ] Required privacy, permission, store and data retention requirements have been verified for this product.

For audits and substantial delivery, maintain a report with status, severity, affected journey/files, evidence, remaining work and owner. Use clear statuses such as implemented, verified locally, verified in staging, verified on device, blocked by external configuration and excluded from this release. Include the exact command/environment for important results and the date of verification.

In the final handoff, lead with what works, explain important changes, list relevant checks and state material unverified items. Never claim deployment because a container built, email delivery because an emulator passed, native performance because web tests passed, or a working feature because its button renders.

## 19. Current documentation and engineering judgment

Verify changing provider behavior and compatibility from primary documentation before relying on it. Preserve user-requested major versions and record justified compatibility decisions. Do not blindly copy obsolete snippets, unsupported native packages or dependency overrides.

Consult the sources near the relevant requirements above, plus these maintained references when applicable:

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/)
- [Expo production builds](https://docs.expo.dev/build/introduction/)
- [Firebase Admin Python Auth reference](https://firebase.google.com/docs/reference/admin/python/firebase_admin.auth)
- [Neon documentation](https://neon.com/docs)
- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [Alembic documentation](https://alembic.sqlalchemy.org/en/latest/)
- [React documentation](https://react.dev/)
- [React Native documentation](https://reactnative.dev/docs/getting-started)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Core Web Vitals guidance](https://web.dev/articles/vitals)

Use judgment within these boundaries. Simplicity, truthful behavior, measured performance, accessible design and proven data integrity take precedence over unnecessary infrastructure or impressive sounding claims.
