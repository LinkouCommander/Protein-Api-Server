# Protein Management API

This is a RESTful API for managing protein data. The API provides functionalities to create, retrieve, update, and delete proteins and fragments, and supports searching based on various criteria. Built with Express and PostgreSQL.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation and Setup](#installation-and-setup)
- [API Endpoints](#api-endpoints)
- [Error Handling](#error-handling)

## Features

- Create new proteins and their fragments.
- Retrieve protein information by ID.
- Search proteins based on specific criteria.
- Get fragments of a specific protein.
- Update protein name and description.
- Delete proteins.
- Support downloading protein sequences.

## Tech Stack

- Node.js
- Express
- PostgreSQL
- dotenv
- fs

## Installation and Setup

1. **Clone the repository**

2. **Install the dependencies listed in `package.json`**
```
npm install
```

3. **Set up PostgreSQL:** Follow the instructions in [PostgreSQL Configuration](/POSTGRESQL_CONFIGURATION.md)

4. **Set up environment:** Create a `.env` file in the root directory and add the following variables:
```
PG_HOST=<your-database-host>
PG_PORT=<your-database-port>
PG_DATABASE=<your-database-name>
PG_USER=<your-database-username>
PG_PASSWORD=<your-database-password>
PORT=3000
MAX_PROTEIN_LENGTH=2000
```

5. **Server boost:**
```
npx nodemon server.js
```

6. **Access the API:** Open browser and go to `http://localhost:3000/api` to start using the API.

## API Endpoints

### GET /api/proteins
Retrieve information about all proteins with support for pagination.

**Query Parameters**:
- `limit`: Maximum number of records to return (optional).
- `offset`: Record to start returning from (optional).

### GET /api/proteins/search
Search proteins based on the provided criteria.

**Query Parameters**:
- `name`: Protein name (optional).
- `molecularWeight`: Filter by molecular weight.
- `sequenceLength`: Filter by sequence length.
- `motif`: Filter by specific motif.
- `sort`: Sort by specified field (optional).

### GET /api/proteins/:proteinId
Retrieve information about a specific protein by ID.

### GET /api/proteins/:proteinId/fragments
Retrieve fragment information for a specified protein.

### GET /api/fragments/:fragmentId
Retrieve information about a specific fragment by ID.

### POST /api/proteins/sequence
Create a new protein by providing its sequence.

**Request Body**:
```txt
ACDEFGHIKLMNPQRSTVWY
```

### POST /api/proteins
Create a new protein by providing its sequence, name, and description.

**Request Body**:
```json
{
    "sequence": "ACDEFGHIKLMNPQRSTVWY",
    "name": "ProteinName",
    "description": "Description of the protein"
}
```

### PUT /api/proteins/:proteinId
Update the name and description of a specific protein.

**Request Body**:
```json
{
    "name": "NewProteinName",
    "description": "Updated description"
}
```

### DELETE /api/proteins/:proteinId
Delete the protein with the specified ID.

## Error Handling
The API uses custom error classes to handle errors and returns appropriate HTTP status codes and error messages. Supported error classes include:
- `BadRequestError`
- `UnauthorizedError`
- `NotFoundError`
- `ConflictError`

## Reference

* [HW7](/hw7-ee547-25sp.pdf)