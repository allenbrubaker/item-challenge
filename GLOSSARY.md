# Glossary

This document defines key terms used throughout the Item Challenge repository.

| Term                             | Definition                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Exam Item**                    | A single test question that includes its content, associated metadata, and version history, intended to assess a student's knowledge or skills in a specific subject area.      |
| **Item Type**                    | The format of the exam item, such as `multiple-choice`, `free-response`, or `essay`.                                                                                            |
| **Difficulty**                   | A numeric rating (1–5) representing the relative challenge of the item for a student.                                                                                           |
| **Version**                      | A specific revision of an item. Each time an item is updated, DynamoDB Streams creates a new version record.                                                                     |
| **Status**                       | The current workflow state of an item, such as `draft`, `review`, `approved`, or `archived`.                                                                                    |
| **Metadata**                     | Administrative details associated with an item, including `author`, timestamps, `tags`, and related versioning information.                                                     |
| **Security Level**               | The classification of item sensitivity, e.g., `standard`, `secure`, or `highly-secure`.                                                                                         |
| **Audit Trail**                  | A chronological record of all updates to an item, retrievable through the `/api/items/:id/audit` endpoint.                                                                      |
| **Lambda Handler**               | The AWS Lambda function that processes and routes incoming API requests.                                                                                                        |
| **Infrastructure as Code (IaC)** | The practice of defining, managing, and provisioning cloud infrastructure (e.g., API Gateway, Lambda, DynamoDB) using code or configuration tools such as AWS CDK or Terraform. |
