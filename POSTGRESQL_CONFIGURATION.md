# PostgreSQL Configuration

## i. Running PostgreSQL in a Docker Container

Use a PostgreSQL instance running in a Docker container for local development. To start a PostgreSQL container with data persistence and an exposed port:

```
docker run -d \
-p 5432:5432 \
-e POSTGRES_PASSWORD=password \
-e POSTGRES_USER=postgres \
-e POSTGRES_DB=protein_db \
-v /path/to/datadir:/var/lib/postgresql/data \
--name postgres \
postgres:latest
```

## ii. Connecting to PostgreSQL

Use the pg package to interact with PostgreSQL from your application. Initialize the database connection before starting the server using a connection pool:

```
// Load environment variables
const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const { Pool } = require('pg');
const app = express();

// Set up configuration variables
const PORT = process.env.PORT || 3000;
const MAX_PROTEIN_LENGTH = process.env.MAX_PROTEIN_LENGTH || 2000;

// Create connection pool
const pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD
});

// Test the database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to PostgreSQL:', err);
        process.exit(1);
    } else {
        console.log('Connected to PostgreSQL');
        // Start the server after the database connection is established
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
});

// Example route using the connection pool and pagination
app.get('/api/proteins', async (req, res) => {
    try {
        // Add pagination similar to Homework #3
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;
        const result = await pool.query(
            'SELECT * FROM proteins ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
```

## iii. Database Schema and Setup

Before running the application, set up the required database schema. You should use the following SQL statements to create the necessary tables:

```
-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create proteins table
CREATE TABLE proteins (
    protein_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(1000),
    molecular_weight FLOAT CHECK (molecular_weight > 0),
    sequence_length INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sequence_url VARCHAR(255)
);

-- Create fragments table
CREATE TABLE fragments (
    fragment_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    protein_id UUID REFERENCES proteins(protein_id) ON DELETE CASCADE,
    sequence VARCHAR(50) CHECK (sequence ~ '^[A-Z]{2,50}$'),
    start_position INTEGER,
    end_position INTEGER,
    secondary_structure VARCHAR(50) CHECK (secondary_structure ~ '^[HEC]+$'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    url VARCHAR(255)
);

-- Create motifs table
CREATE TABLE motifs (
    motif_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    fragment_id UUID REFERENCES fragments(fragment_id) ON DELETE CASCADE,
    motif_pattern VARCHAR(50) NOT NULL,
    motif_type VARCHAR(50),
    start_position INTEGER,
    end_position INTEGER,
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'basic' CHECK (role IN ('admin', 'basic'))
);

-- Insert default users
INSERT INTO users (id, name, role) VALUES
('admin-user-001', 'Admin User', 'admin'),
('user-001', 'Basic User', 'basic');

-- Create indexes for better query performance
CREATE INDEX idx_proteins_name ON proteins(name);
CREATE INDEX idx_fragments_protein_id ON fragments(protein_id);
CREATE INDEX idx_fragments_sequence ON fragments(sequence);

-- Create motif indexes
CREATE INDEX idx_motifs_fragment_id ON motifs(fragment_id);
CREATE INDEX idx_motifs_pattern ON motifs(motif_pattern);
```