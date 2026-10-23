# Project Review and Technical Documentation

## 1. Project overview and objectives

This repository contains backend code for a student On-Duty (OD) and leave management system. Its intended workflow is to let students sign in, submit an OD/leave request, and let faculty review requests. Student information and attendance are also represented in the code.

The repository currently has **two independent backend implementations**:

- A Node.js and Express API at the repository root (`server.js`, `routes/`, `models/`).
- A Spring Boot API under `backend/` (`backend/src/main/java/`).

They use the same MongoDB database name and default port, but have different schemas, routes, and authentication behavior. They are alternatives, not one combined service. Running both unchanged will cause a port conflict on `8081`; choose one implementation or configure separate ports before running both. The endpoint and feature inventory below distinguishes the two.

## 2. Tech stack and architecture

### Root Node.js API

- Node.js with CommonJS modules.
- Express 5 for HTTP routing and JSON middleware.
- Mongoose for MongoDB models and connection management.
- MongoDB Atlas as the intended database host.
- `cors` for cross-origin requests and `dotenv` for environment configuration.
- `bcryptjs` and `jsonwebtoken` are used by the login route for password comparison and JWT creation.
- `pdfkit` streams approved-request certificates as PDF responses.
- `nodemon` supports local development.

`server.js` builds the Express application in `createApp()`, mounts route modules, then `startServer()` connects to MongoDB before listening. It reads `MONGO_URI` from the environment and defaults `PORT` to `8081`. The module exports both functions, so app creation is separate from process startup.

### Nested Spring Boot API

- Java 21 and Spring Boot 4.
- Spring Web MVC controllers, Spring Data MongoDB repositories, and Spring Security.
- BCrypt password encoder bean and validation/security dependencies.
- MongoDB Atlas configuration in `backend/src/main/resources/application.properties`.

The Java application uses controller → service → repository → MongoDB layers. It is a separate deployable project with its own Maven build (`backend/pom.xml`).

## 3. Database schema and data flow

### Node/Mongoose collections

| Model / collection | Fields in code | Notes |
| --- | --- | --- |
| `User` / `users` | `username` (required, unique), `registerNumber` (optional, sparse unique), `password` (required), `name`, `role` (`STUDENT`, `FACULTY`, or `ADMIN`), `studentId`, `department`, `year` | Login reads this model. Passwords are expected to be bcrypt hashes. |
| `LeaveRequest` / `leaverequests` (Mongoose default pluralization) | `studentId`, `studentUserId`, `type`, `from`, `to`, `reason` (required); `status` (`Pending`, `Approved`, or `Rejected`); `reviewedBy`, `reviewedAt`, `facultyComment` | Dates are stored as strings. `studentId` is associated with the authenticated user's token claim; `studentUserId` identifies the account for notifications. Review metadata is recorded on the final decision. |
| `Attendance` / `attendances` | `studentId`, `date`, `status` (`Present` or `Absent`), `recordedBy`, timestamps | One record per student per calendar date, enforced by a compound unique index. Daily records feed the attendance summary. |
| `Notification` / `notifications` | `recipientId`, `category`, `message`, `relatedRequestId`, `readAt`, timestamps | Notifications are private to a user; an index supports unread counts and recent-message queries. |

The root Node project does **not** define a Mongoose model for Student. Its student route still returns hardcoded sample JSON. Faculty accounts are represented as `User` records with role `FACULTY` rather than a separate faculty schema.

Typical intended Node request flow:

1. A client posts credentials to `/api/auth/login`.
2. The route finds a user by username or register number and compares the submitted password with the stored hash using `bcrypt.compare`.
3. On success it signs a one-day JWT containing user ID, student ID, and role, then returns a password-free user object.
4. Leave endpoints require a bearer token. Students can submit requests and only see their own requests; faculty/admin users can list all requests and update statuses.
5. New requests notify faculty/admin accounts, and review decisions notify the submitting student. Notifications are stored per recipient and exposed through authenticated endpoints.

The seeder reads the database URI and demo passwords from environment variables, bcrypt-hashes passwords, and upserts the two development accounts without deleting other users.

### Spring Data MongoDB collections

| Entity / collection | Fields in code | Notes |
| --- | --- | --- |
| `User` / `users` | `id`, `username`, `password`, `role` | Used by Java registration and login services. |
| `Student` / `students` | `id`, `name`, `registerNumber`, `email`, `department`, `year` | CRUD endpoints are implemented. |
| `LeaveRequest` / `leave_requests` | `id`, `studentId`, `leaveType`, `fromDate`, `toDate`, `reason`, `status` | CRUD endpoints are implemented. |
| `Attendance` / `attendance` | `id`, `studentId`, `totalClasses`, `attendedClasses` | CRUD endpoints and percentage lookup are implemented. |

Java records identify a student by a string `studentId`, but the code shown does not declare a database-level relationship or cascading behavior between the entities. Services/repositories implement persistence operations. The Node and Java leave schemas use different field names and collection naming conventions, so clients and stored data are not automatically interchangeable.

## 4. API endpoints and authentication flow

### Root Node/Express API

All endpoints are mounted by `server.js`. JSON parsing and general CORS middleware apply globally.

| Method | Path | Behavior in current code |
| --- | --- | --- |
| `GET` | `/` | Returns a plain-text service-running message. |
| `POST` | `/api/auth/login` | Looks up username, checks bcrypt password, returns a one-day JWT and user ID/username/role. Invalid credentials return HTTP 400. |
| `POST` | `/api/leave/` | Requires a student bearer token; validates fields and ISO dates, then creates a persisted request using student ID from the token. Accepts aliases for type/date fields. |
| `GET` | `/api/leave/` | Requires a bearer token; students receive their own requests, while faculty/admin receive all requests. Optional `?status=Pending` (or `Approved`/`Rejected`) filters the review queue. |
| `PATCH` | `/api/leave/:id/status` | Requires faculty/admin bearer token; accepts only `Approved` or `Rejected`, with optional `facultyComment`. Records reviewer ID and time; a second decision returns 409. |
| `GET` | `/api/leave/:id/certificate.pdf` | Requires a bearer token; streams a PDF only for approved requests. Students can download only their own certificate; faculty/admin can download any. |
| `POST`, `GET`, `PATCH` | `/api/leave-requests/...` | Alias mount of the same leave router. |
| `GET` | `/api/students/` | Returns one hardcoded sample student. |
| `GET` | `/api/attendance/` | Requires a bearer token; students see their own records, faculty/admin can see all or filter by `studentId`. |
| `GET` | `/api/attendance/summary` | Requires a bearer token; returns class counts, attendance percentage, 75% minimum, and eligibility. Students get their own summary; faculty/admin can request `?studentId=...` or omit it for an overall summary. |
| `POST` | `/api/attendance/` | Requires faculty/admin bearer token; records `Present`/`Absent` for one student and date. Duplicate student/date records return 409. |
| `GET` | `/api/notifications/` | Requires a bearer token; returns the current user's 50 most recent notifications. `?unreadOnly=true` filters unread items. |
| `GET` | `/api/notifications/unread-count` | Returns the current user's unread count for the dashboard badge. |
| `PATCH` | `/api/notifications/:id/read` | Marks one of the current user's notifications as read. |
| `PATCH` | `/api/notifications/read-all` | Marks all current user's unread notifications as read. |

### Node authentication details

The login endpoint expects `{"username":"...","password":"..."}` or a register number in place of username. On success it returns a one-day JWT and password-free profile. `JWT_SECRET` must be configured with at least 32 characters for the server to start. Leave, attendance, and notification endpoints enforce bearer-token authentication and role checks. The student sample endpoint remains public and returns fixed data. Notification delivery is persisted in MongoDB and fetched by the client; no websocket or push delivery is configured.

`seed.js` requires `MONGO_URI`, `SEED_STUDENT_PASSWORD`, and `SEED_FACULTY_PASSWORD`; it hashes passwords and upserts known development users. It no longer deletes the users collection.

### Nested Spring Boot API

The Java controllers expose a second API on port `8081` by default.

| Method | Path | Behavior in current code |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Rejects an existing username; registers a user through `UserService`. |
| `POST` | `/api/auth/login` | Checks username and BCrypt password, then returns the user object. It does not issue a JWT. |
| `POST`, `GET`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` | `/api/students` | Create, list, read, update, and delete students. |
| `POST`, `GET`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` | `/api/leave-requests` | Create, list, read, update, and delete leave requests. |
| `POST`, `GET`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` | `/api/attendance` | CRUD attendance records. |
| `GET` | `/api/attendance/student/{studentId}/percentage` | Returns the calculated attendance percentage for a student. |

Spring Security is configured to permit all API and other requests. Authentication is therefore an application-level login check only; no authenticated session or token protects controller operations. CORS is configured for `http://localhost:5173`.

## 5. Key features implemented

- Student, faculty, and admin role values in the Node user schema.
- Node password comparison and one-day JWT generation at login, with bearer and role protection on leave operations.
- Java account registration and BCrypt password encoding/checking.
- Persisted leave/OD request submission and listing, student-scoped history, and faculty/admin review with pending filters and reviewer audit metadata in the Node API.
- On-demand PDF certificates for approved requests in the Node API.
- Persisted in-app notifications for new submissions and faculty decisions, with unread count and read-state endpoints.
- Full leave request CRUD in the Java API.
- Student profile CRUD in Java; a fixed sample student in Node.
- Attendance CRUD and percentage calculation in Java; daily attendance records and a calculated 75% eligibility summary in Node.
- MongoDB persistence through Mongoose in Node and Spring Data MongoDB in Java.
- CORS and JSON request handling in Node; configured CORS in Java.
- Environment-based MongoDB URI in the Node server startup.

## Technical review: current limitations and risks

1. **Credentials in configuration:** the Java `application.properties` still contains a MongoDB Atlas connection string with embedded credentials. The Node API now reads `MONGO_URI` from the environment. Rotate the exposed credential, remove it from Java configuration/source history as appropriate, and use environment/secrets management.
2. **Seeding:** Node `seed.js` now requires environment passwords, bcrypt-hashes them, and upserts only the two configured demo accounts rather than deleting the users collection. Keep it limited to a development database.
3. **Password response data:** the Java login controller still returns the persisted `User` object, which includes the password hash; return a password-free response DTO.
4. **Authentication coverage:** Node leave, attendance, and notification operations enforce bearer tokens and role checks. The Node student sample route remains public, and the separate Java Security config still permits every request.
5. **Validation and persistence errors:** Node validates required leave fields, real `YYYY-MM-DD` dates, date order, field lengths, and status updates. Apply consistent centralized error handling and validation to the remaining routes.
6. **Inconsistent API/data contracts:** Node uses `type/from/to` and Java uses `leaveType/fromDate/toDate`; student and attendance features are also implemented differently. Agree on one contract and one backend as the source of truth.
7. **Validation coverage:** Node leave and attendance writes have request-level validation; student and Java API routes still need equivalent validation and consistent error handling.
8. **Frontend integration:** clients must store the returned real JWT and send `Authorization: Bearer <token>` to leave, attendance, and notification endpoints. Static/demo tokens will now be rejected.
9. **Certificate verification:** PDFs are generated from approved database records and access-controlled, but are not digitally signed and do not include an independent public verification hash or endpoint.
10. **Notification delivery:** notifications are stored and fetched through the API; clients need to poll or refresh to show new items. Notification creation is best-effort after the related request change, so a notification write failure is logged without rolling back the leave operation. Email, browser push, and websocket delivery are not implemented.
11. **Runtime configuration:** both implementations default to port `8081`; if the two projects are intended to coexist, assign distinct ports and document which API the frontend targets.
12. **Documentation/build separation:** root `package.json` describes the Node service; `backend/pom.xml` describes a separate Java service. The repository should clarify whether the Java project is a migration, alternative, or active companion service.

## Running the Node service

Install dependencies with `npm install`, copy `.env.example` to `.env`, and set `MONGO_URI` plus a random `JWT_SECRET` of at least 32 characters. Set `INSTITUTION_NAME` to customize certificate branding. To create/update development accounts, also set `SEED_STUDENT_PASSWORD` and `SEED_FACULTY_PASSWORD`, then run `node seed.js` against a development database. Start with `npm start` (or `npm run dev` for nodemon); the server listens on `PORT` or `8081`. The `npm test` script is currently a placeholder and does not run a test suite.

## Summary

The Node API now supports authenticated leave submission/review, attendance records and summaries, PDF certificates, and stored notifications. The repository still contains a separate Spring Boot implementation and some sample-only Node student data. Before production use, choose the active backend, externalize and rotate credentials, secure the Java API if it remains active, and connect the frontend to the authenticated Node endpoints.
