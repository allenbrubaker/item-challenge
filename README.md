# Item Challenge

Exam item management API implemented as a serverless TypeScript application.

## API

All routes are served by API Gateway HTTP API v2 and protected by a Lambda authorizer that validates Cognito access tokens.

```text
POST   /api/items              Create a new exam item; returns 201 with the item
GET    /api/items/{id}         Retrieve an item; returns 200 with the item
PUT    /api/items/{id}         Update an item; returns 204 with no body
GET    /api/items              List items with cursor pagination; returns 200
GET    /api/items/{id}/audit   Get version snapshots with cursor pagination; returns 200
```

List and audit requests use cursor pagination:

```text
GET /api/items?limit=25
GET /api/items?limit=25&cursor=<opaque-cursor>
GET /api/items?subject=AP%20Biology&status=approved&limit=25
GET /api/items/{id}/audit?limit=25&cursor=<opaque-cursor>
```

Validated enum values:

- `itemType`: `multiple-choice`, `free-response`, `essay`
- `metadata.status`: `draft`, `review`, `approved`, `archived`
- `securityLevel`: `standard`, `secure`, `highly-secure`

## Infrastructure

AWS CDK provisions:

- DynamoDB single-table storage named `{APP_ENV}-challenge-items`
- Generic GSIs named `gsi`, `gsi2`, `gsi3`, and `gsi4`
- Cognito User Pool and app client
- Lambda authorizer
- Five route-specific Lambda functions
- DynamoDB Stream and stream Lambda for asynchronous version snapshots
- API Gateway HTTP API
- CloudWatch log groups and DynamoDB table permissions scoped to this table

`APP_ENV` must be one of `local`, `dev`, `qa`, `int`, `uat`, or `prod`. Resource names are prefixed with `{APP_ENV}-challenge-`.

`LOG_LEVEL` controls the minimum log severity emitted by Lambda code. Supported values are `debug`, `info`, `warn`, and `error`.

## Commands

```bash
pnpm install
pnpm build
pnpm test
APP_ENV=dev pnpm cdk:synth
APP_ENV=dev pnpm deploy
pnpm deploy:local
```

`pnpm deploy:local` starts LocalStack, bootstraps CDK locally, and deploys with `APP_ENV=local`.

## Notes

Unknown handler exceptions are logged and returned as:

```json
{ "error": "An internal error occurred." }
```

Known custom errors and validation errors return public-safe messages with appropriate status codes.
