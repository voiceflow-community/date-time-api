# Requirements Document

## Introduction

This feature involves building a Node.js (v20+) RESTful API server that provides timezone-related functionality. The server will allow users to get the current time in any timezone and convert time between different timezones. The API will include comprehensive error handling, input validation using Zod, and Swagger documentation. Additionally, the solution will include Docker containerization with Docker Compose for easy deployment on servers using solutions like Coolify.

## Requirements

### Requirement 1

**User Story:** As an API consumer, I want to get the current time in any specified timezone, so that I can display accurate local time information in my applications.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/time/current/{timezone}` THEN the system SHALL return the current date and time in the specified timezone
2. WHEN the timezone parameter is valid THEN the system SHALL return a JSON response with ISO 8601 formatted timestamp, timezone name, and UTC offset
3. WHEN the timezone parameter is invalid THEN the system SHALL return a 400 Bad Request error with descriptive message
4. WHEN no timezone is specified THEN the system SHALL return a 400 Bad Request error

### Requirement 2

**User Story:** As an API consumer, I want to convert a specific time from one timezone to another, so that I can coordinate events across different geographical locations.

#### Acceptance Criteria

1. WHEN a POST request is made to `/api/time/convert` with source time, source timezone, and target timezone THEN the system SHALL return the converted time in the target timezone
2. WHEN all conversion parameters are valid THEN the system SHALL return a JSON response with the original time, converted time, source timezone, and target timezone information
3. WHEN any conversion parameter is invalid or missing THEN the system SHALL return a 400 Bad Request error with validation details
4. WHEN the source time format is invalid THEN the system SHALL return a 400 Bad Request error specifying the expected format

### Requirement 3

**User Story:** As an API consumer, I want to access comprehensive API documentation, so that I can understand how to properly use all available endpoints.

#### Acceptance Criteria

1. WHEN a GET request is made to `/api/docs` THEN the system SHALL serve an interactive Swagger UI documentation page
2. WHEN the Swagger documentation is accessed THEN it SHALL include all available endpoints with request/response schemas
3. WHEN viewing endpoint documentation THEN it SHALL include example requests and responses for each endpoint
4. WHEN the API schema changes THEN the Swagger documentation SHALL automatically reflect those changes

### Requirement 4

**User Story:** As an API consumer, I want to receive clear and consistent error messages, so that I can quickly identify and resolve issues with my requests.

#### Acceptance Criteria

1. WHEN any API request fails validation THEN the system SHALL return a structured error response with error code, message, and details
2. WHEN a server error occurs THEN the system SHALL return a 500 Internal Server Error with a generic message without exposing internal details
3. WHEN an endpoint is not found THEN the system SHALL return a 404 Not Found error
4. WHEN request rate limits are exceeded THEN the system SHALL return a 429 Too Many Requests error

### Requirement 5

**User Story:** As a developer, I want all API inputs to be validated using Zod schemas, so that data integrity is maintained and clear validation errors are provided.

#### Acceptance Criteria

1. WHEN any API endpoint receives a request THEN the system SHALL validate all input parameters using Zod schemas
2. WHEN input validation fails THEN the system SHALL return detailed validation errors indicating which fields are invalid and why
3. WHEN input validation passes THEN the system SHALL process the request with type-safe data
4. WHEN new endpoints are added THEN they SHALL include appropriate Zod validation schemas

### Requirement 6

**User Story:** As a DevOps engineer, I want to deploy the application using Docker containers, so that I can easily manage and scale the service in any environment.

#### Acceptance Criteria

1. WHEN the Dockerfile is built THEN it SHALL create a production-ready Node.js container with the timezone API server
2. WHEN the Docker Compose file is used THEN it SHALL orchestrate the application container with proper networking and environment configuration
3. WHEN the container starts THEN the API server SHALL be accessible on the configured port
4. WHEN deployed on platforms like Coolify THEN the Docker Compose configuration SHALL be compatible and functional

### Requirement 7

**User Story:** As a system administrator, I want the API to include health check endpoints, so that I can monitor the service status and ensure high availability.

#### Acceptance Criteria

1. WHEN a GET request is made to `/health` THEN the system SHALL return a 200 OK response with service status information
2. WHEN the service is healthy THEN the health check SHALL include uptime, memory usage, and service version
3. WHEN the service encounters issues THEN the health check SHALL reflect the degraded status
4. WHEN monitoring systems query the health endpoint THEN they SHALL receive consistent and reliable status information