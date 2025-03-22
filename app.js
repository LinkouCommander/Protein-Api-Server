'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { BadRequestError, UnauthorizedError, NotFoundError, ConflictError } = require('./error');
const { 
    generateProteinName, 
    calculateMolecularWeight, 
    predictSecondaryStructure, 
    generateStructureSVG, 
    authenticateUser,
    createProteinWithFragments,
    getUpdatedFragmentData,
    getMotifs
} = require('./lib');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());
dotenv.config();

const PORT = process.env.PORT || 3000;
const MAX_PROTEIN_LENGTH = process.env.MAX_PROTEIN_LENGTH || 2000;

const DATA_FILE = 'data/proteins.json';

// ensureDataFileExists()
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

app.use('/api', async (req, res, next) => {
    try {
        // Extract the user ID from request headers
        const userId = req.header('X-User-ID');

        // If authorized, attach user information to the request object
        req.user = await authenticateUser(pool, userId);

        // Continue to the next middleware or route handler
        next();
    } catch (error) {
        next(error);
    }
});

app.get('/api/proteins', async (req, res) => {
    try {
        let limit = req.query.limit ? parseInt(req.query.limit) : null;
        let offset = req.query.offset ? parseInt(req.query.offset) : null;
        if((limit != null && limit <= 0) || (offset !== null && offset < 0)) {
            throw new BadRequestError('Invalid query parameters');
        }

        const countRow = await pool.query('SELECT * FROM proteins;');
        const proteinsListLength = countRow.rowCount;
        if(offset != null && offset >= proteinsListLength) {
            throw new BadRequestError('Invalid query parameters');
        }

        let sqlQuery = `
            SELECT * 
            FROM proteins
            ORDER BY created_at ASC
        `
        if(limit === null && offset === null) {
            const proteinList = await pool.query(sqlQuery);
            return res.status(200).json(proteinList.rows);
        }
        
        if(limit === null) {
            limit = proteinsListLength;
        }
        if(offset === null) {
            offset = 0;
        }

        sqlQuery += " LIMIT $1 OFFSET $2;";

        const paginatedProteinList = await pool.query(sqlQuery, [limit, offset]);
        res.status(200).json({
            proteins: paginatedProteinList.rows,
            total: proteinsListLength,
            limit: limit,
            offset: offset
        })
    } catch (error) {
        next(error);
    }
});

app.get('/api/proteins/:proteinId/fragments', async (req, res, next) => {
    try {
        const proteinId = req.params.proteinId;

        const protein = await pool.query("SELECT * FROM proteins WHERE protein_id = $1;", [proteinId]);
        if(protein.rows.length === 0) throw new NotFoundError("Protein with given ID does not exist" );
    
        const fragmentData = await pool.query("SELECT * FROM fragments WHERE protein_id = $1;", [proteinId]);
    
        const updatedFragmentData = await getUpdatedFragmentData(pool, fragmentData);
    
        res.status(200).json(updatedFragmentData);
    } catch (error) {
        next(error);
    }
})

// Route to get a protein by ID
app.get('/api/proteins/:proteinId', async (req, res, next) => {
    try {
        const proteinId = req.params.proteinId;

        const protein = await pool.query("SELECT * FROM proteins WHERE protein_id = $1;", [proteinId]);
        if(protein.rows.length === 0) throw new NotFoundError("Protein with given ID does not exist" );

        res.status(200).json(protein.rows)
    } catch (error) {
        next(error);
    }
});

// Route to create a new protein
app.post('/api/proteins/sequence', async (req, res, next) => {
    try {
        const sequence = req.body;
        console.log(sequence);
        if(!sequence || 
            sequence.length > 2000 || 
            sequence.length < 20 || 
            !/^[ACDEFGHIKLMNPQRSTVWY]+$/.test(sequence)
        ) {
            throw new BadRequestError("Invalid input or sequence length exceeded");
        }
    
        const proName = generateProteinName(sequence)
    
        const sequenceUrl = "abc.com";

        // Proceed with creating new protein
        const proteinData = {
            name: proName,
            description: "",
            molecularWeight: calculateMolecularWeight(sequence),
            sequenceLength: sequence.length,
            sequenceUrl
        };

    
        const { protein_id, isoCreatedDate, isoUpdatedDate } = await createProteinWithFragments(pool, proteinData, sequence);
    
        const proteinOutput = {
            proteinId: protein_id,
            name: proName,
            description: "",
            molecularWeight: calculateMolecularWeight(sequence),
            sequenceLength: sequence.length,
            createdAt: isoCreatedDate,
            updatedAt: isoUpdatedDate,
            sequenceUrl
        }

        res.status(201).json(proteinOutput);
    } catch (error) {
        next(error);
    }
});

// Route to create a new protein
app.post('/api/proteins', async (req, res, next) => {
    try {
        const { sequence, name, description = '' } = req.body;
        const proName = name ? name : generateProteinName(sequence);
    
        if(sequence.length > 2000 || 
            sequence.length < 20 || 
            name.length > 100 || 
            description.length > 1000 ||
            !/^[ACDEFGHIKLMNPQRSTVWY]+$/.test(sequence)
        ) {
            throw new BadRequestError("Invalid input or sequence length exceeded");
        }

        const sequenceUrl = "abc.com";

        // Proceed with creating new protein
        const proteinData = {
            name: proName,
            description,
            molecularWeight: calculateMolecularWeight(sequence),
            sequenceLength: sequence.length,
            sequenceUrl
        };

        const { protein_id, isoCreatedDate, isoUpdatedDate } = await createProteinWithFragments(pool, proteinData, sequence);
    
        const proteinOutput = {
            proteinId: protein_id,
            name: proName,
            description,
            molecularWeight: calculateMolecularWeight(sequence),
            sequenceLength: sequence.length,
            createdAt: isoCreatedDate,
            updatedAt: isoUpdatedDate,
            sequenceUrl
        }

        res.status(201).json(proteinOutput);
    } catch (error) {
        next(error);
    }
});

// update protein
app.put('/api/proteins/:proteinId', async (req, res, next) => {
    try {
        const proteinId = req.params.proteinId;
        let { name="", description="" } = req.body;
        
        const protein = await pool.query("SELECT * FROM proteins WHERE protein_id = $1;", [proteinId]);
        if(protein.rows.length === 0) throw new NotFoundError("Protein with given ID does not exist");
        
        if (name.trim() === "") name = protein.rows[0].name;
        if (description.trim() === "") description = protein.rows[0].description;

        if(name.length > 100 || description.length > 1000)  throw new BadRequestError("Invalid input data");

        const proteinUpdate = `
            UPDATE proteins
            SET name = $1, description = $2
            WHERE protein_id = $3
            RETURNING *;
        `
        const proteinResp = await pool.query(proteinUpdate, [name, description, proteinId]);

        res.status(200).json(proteinResp.rows[0]);
    } catch (error) {
        next(error);
    }
});

// // delete protein
// app.delete('/api/proteins/:proteinId', (req, res, next) => {
//     try {
//         const proteinId = req.params.proteinId;
//         let proteins = readProteinsList().proteins;
    
//         const idx = proteins.findIndex(p => p.id === proteinId);
//         if (idx === -1) return res.status(404).json({ error: 'Protein with given ID does not exist' });
    
//         proteins.splice(idx, 1);
//         fs.writeFileSync(DATA_FILE, JSON.stringify({ proteins }, null, 2));
    
//         const filePath = path.join(__dirname, 'data', `${proteinId}.json`);
//         fs.unlinkSync(filePath);
    
//         res.status(204).send();
//     } catch (error) {
//         next(error);
//     }
// });

// // get secondary structure
// app.get('/api/proteins/:proteinId/structure', async (req, res, next) => {
//     try {
//         const proteinId = req.params.proteinId;

//         const protein = await pool.query("SELECT * FROM proteins WHERE protein_id = $1;", [proteinId]);
//         if(!protein) throw new NotFoundError("Protein with given ID does not exist");

//         const sequence = protein.data.sequence;
//         const structure = predictSecondaryStructure(protein.data.sequence);
//         if(req.accepts('json')) {
//             const strjs = {
//                 proteinId,
//                 sequence,
//                 secondaryStructure: structure
//             }
//             return res.status(200).json(strjs);
//         }
//         else if(req.accepts('svg')) {
//             const svg = generateStructureSVG(sequence, structure);
//             res.status(200).type('svg').send(svg);
//         }
//         else {
//             res.status(406).json({ error: 'Not Acceptable' });
//         }

//     } catch (error) {
//         next(error);
//     }
// }
// );

// Error handling middleware
function errorHandler(err, req, res, next) {
    console.error(err.message);

    if (err instanceof BadRequestError || 
        err instanceof UnauthorizedError || 
        err instanceof NotFoundError || 
        err instanceof ConflictError) {
        res.status(err.code).json({ error: err.message });
    }
    else {
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Add error handling middleware last
app.use(errorHandler);