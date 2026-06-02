# Getting Started

## Install

```bash
pnpm install
```

## Validate Locally

```bash
pnpm build
pnpm test
APP_ENV=dev pnpm cdk:synth
```

The project no longer uses `src/server.ts` or an in-memory local server. Handlers are Lambda entrypoints under `src/handlers/`.

## Deploy To LocalStack

Docker must be running.

```bash
pnpm deploy:local
```

This command starts LocalStack, runs a local CDK bootstrap, and deploys the stack with `APP_ENV=local`.

The stack outputs include:

- API endpoint
- DynamoDB table name
- Cognito User Pool ID
- Cognito User Pool client ID

## Deploy To AWS

Configure AWS credentials first, then choose an environment:

```bash
APP_ENV=dev pnpm deploy
```

Supported environments are `local`, `dev`, `qa`, `int`, `uat`, and `prod`.

Set `LOG_LEVEL` to control the minimum emitted log severity:

```bash
LOG_LEVEL=warn APP_ENV=dev pnpm deploy
```

Supported log levels are `debug`, `info`, `warn`, and `error`.

## Project Layout

```text
cdk/                 CDK app and stack
src/errors/          Custom HTTP errors
src/handlers/        Lambda handlers and handler factory
src/services/        Inversify container, ConfigService, LogService, and ItemService
src/storage/         Storage interface
src/types/           API and item types plus Zod schemas
```

## Pagination

`GET /api/items` uses cursor pagination:

```text
GET /api/items?limit=25
GET /api/items?limit=25&cursor=<opaque-cursor>
```

The cursor is an opaque base64url-encoded DynamoDB `LastEvaluatedKey`. Clients should pass it back unchanged as `cursor`.
