# InterviewReady — API Testing Guide (Production-Quality)

> **Base URL:** `http://localhost:8080`
> **Auth:** All `/api/**` endpoints require `Authorization: Bearer <JWT>`
> **Content-Type:** `application/json` unless noted otherwise
> **Source of truth:** `workflow.md` (frontend models) + `new_feature.md` (behavioral JSON schema)

---

## Step 0 — Authentication

### POST `/register`
```json
{
    "username": "testuser99",
    "email": "test@interviewready.com",
    "password": "Test123!"
}
```

### POST `/login`
```json
{
    "username": "testuser99",
    "password": "Test123!"
}
```
**→ Copy the `token` from the response. Use it as `Bearer <token>` in all subsequent requests.**

---

## Step 1A — Generate MCQ Questions

### POST `/api/questions/generate-mcq`
**Content-Type:** `text/plain`

**Body (raw text):**
```
We are hiring a Senior Java Backend Developer with 5+ years of experience.

Required Skills:
- Java 17+, Spring Boot 3.x, Spring Security, Spring Data JPA
- Microservices architecture, RESTful API design, gRPC
- PostgreSQL, Redis, Elasticsearch
- Docker, Kubernetes, Helm Charts
- CI/CD pipelines (Jenkins, GitHub Actions)
- Event-driven architecture (Kafka, RabbitMQ)
- Design patterns (CQRS, Saga, Circuit Breaker)
- Unit testing (JUnit 5, Mockito), Integration testing

Responsibilities:
- Design and implement scalable backend services handling 10K+ RPS
- Lead code reviews and mentor junior developers
- Own production incident response and post-mortem processes
- Collaborate with frontend, DevOps, and product teams
```

**Expected Response:** `McqGenerationDTO` → `{ jobProfileTitle, mcq[10] }` — ~30-40 sec.

---

## Step 1B — Generate Coding Problems (call in PARALLEL with 1A)

### POST `/api/questions/generate-coding`
**Content-Type:** `text/plain`

**Body:** Same Job Description as Step 1A.

**Expected Response:** `CodingGenerationDTO` → `{ jobProfileTitle, coding[2] }` — ~30-40 sec.

<!-- SECTIONS: Behavior, Domain, Coding, Final Report follow in api_testing_behavior.md and api_testing_remaining.md -->
<!-- The full guide is split across 3 files for maintainability -->
