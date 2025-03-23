const fs = require('fs');
const path = require('path');
const { BadRequestError, UnauthorizedError, NotFoundError, ConflictError } = require('./error');
const { Console } = require('console');

const propensities = {
    A: { H: 1.42, E: 0.83, C: 0.80 }, R: { H: 1.21, E: 0.84, C: 0.96 },
    N: { H: 0.67, E: 0.89, C: 1.34 }, D: { H: 1.01, E: 0.54, C: 1.35 },
    C: { H: 0.70, E: 1.19, C: 1.06 }, Q: { H: 1.11, E: 1.10, C: 0.84 },
    E: { H: 1.51, E: 0.37, C: 1.08 }, G: { H: 0.57, E: 0.75, C: 1.56 },
    H: { H: 1.00, E: 0.87, C: 1.09 }, I: { H: 1.08, E: 1.60, C: 0.47 },
    L: { H: 1.21, E: 1.30, C: 0.59 }, K: { H: 1.16, E: 0.74, C: 1.07 },
    M: { H: 1.45, E: 1.05, C: 0.60 }, F: { H: 1.13, E: 1.38, C: 0.59 },
    P: { H: 0.57, E: 0.55, C: 1.72 }, S: { H: 0.77, E: 0.75, C: 1.39 },
    T: { H: 0.83, E: 1.19, C: 0.96 }, W: { H: 1.08, E: 1.37, C: 0.64 },
    Y: { H: 0.69, E: 1.47, C: 0.87 }, V: { H: 1.06, E: 1.70, C: 0.41 }
}

function ensureDataFileExists() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({ proteins: [] }, null, 2));
    }
}

function readProteinsList() {
    // Implementation to load proteins.json
    if(!fs.existsSync(DATA_FILE)) return { proteins: [] };
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function updateProteinList(proteinId, name) {
    let data = readProteinsList();

    const pro = data.proteins.find(p => p.id === proteinId);
    if(!pro) {
        data.proteins.push({ id: proteinId, name });
    }
    else {
        pro.name = name;
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function readProteins(proteinId) {
    const filePath = path.join(__dirname, 'data', `${proteinId}.json`);
    if(!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath));
}

function writeProteins(filePath, protein) {
    fs.writeFileSync(filePath, JSON.stringify(protein, null, 2));
}

function generateProteinName(sequence) {
    const timestep = Math.floor(Date.now()/1000);
    const seq = sequence.slice(0, 8);
    return `Protein_${seq}_${timestep}`;
}

function calculateMolecularWeight(sequence) {
    const molecularWeights = {
        A: 89.09, R: 174.20, N: 132.12, D: 133.10, C: 121.16,
        E: 147.13, Q: 146.15, G: 75.07, H: 155.16, I: 131.17,
        L: 131.17, K: 146.19, M: 149.21, F: 165.19, P: 115.13,
        S: 105.09, T: 119.12, W: 204.23, Y: 181.19, V: 117.15
    };

    let sum = 0;    
    for(const aa of sequence) {
        sum += molecularWeights[aa];
    }

    return sum;
}

function predictSecondaryStructure(sequence) {
    let str = "";
    for(const aa of sequence) {
        let {H, E, C} = propensities[aa];
        if(H > E && H > C) {
            str += "H";
        }
        else if(E > C) {
            str += "E";
        }
        else {
            str += "C";
        }
    }
    return str;
}

function calculateConfidenceScore(sequence) {
    let arr = [];
    for(const aa of sequence) {
        propensityValue = Object.values(propensities[aa]);
        const sortedValues = propensityValue.sort((a, b) => b - a);
        const maxi = sortedValues[0];
        const second_maxi = sortedValues[1];

        arr.push(maxi - second_maxi);
    }
    return arr;
}

function generateStructureSVG(sequence, secondaryStructure) {
    const svgWidth = sequence.length * 10;
    const svgHeight = 50;
    let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;

    for (let i = 0; i < sequence.length; i++) {
        let color;
        switch (secondaryStructure[i]) {
            case 'H':
                color = 'red';
                break;
            case 'E':
                color = 'yellow';
                break;
            default:
                color = 'gray';
        }
        svg += `<rect x="${i * 10}" y="0" width="10" height="30" fill="${color}" />`;
    }

    // Add legend
    svg += `
        <rect x="10" y="35" width="10" height="10" fill="red" />
        <text x="25" y="45" font-size="10">alpha-helix</text>
        <rect x="70" y="35" width="10" height="10" fill="yellow" />
        <text x="85" y="45" font-size="10">beta-strand</text>
        <rect x="140" y="35" width="10" height="10" fill="gray" />
        <text x="155" y="45" font-size="10">coil</text>
    `;

    svg += '</svg>';
    return svg;
}

async function authenticateUser(pool, userId) {
    try {
        // Handle missing authentication
        if (!userId) {
            throw new UnauthorizedError('[Unauthorized] Missing user ID');
        }

        // Query the database to verify if the user exists
        const user = await pool.query('SELECT * FROM users WHERE id = $1;', [userId]);
        
        // Check query results and handle unauthorized access
        if (user.rowCount === 0) {
            throw new UnauthorizedError('[Unauthorized] User not found')
        }
        
        return {
            id: user.rows[0].id,
            name: user.rows[0].name,
            role: user.rows[0].role
        };
    } catch (error) {
        // Log the error for debugging
        throw error;
    }
}

// Example: Creating a protein and its fragments in a transaction
async function createProteinWithFragments(pool, proteinData, sequence) {
    try {
        // Begin transaction
        await pool.query('BEGIN');

        // Insert protein data
        const proteinResult = await pool.query(
            `INSERT INTO proteins(name, description, molecular_weight, sequence_length)
             VALUES($1, $2, $3, $4) RETURNING protein_id, created_at, updated_at`,
            [
                proteinData.name,
                proteinData.description,
                proteinData.molecularWeight,
                proteinData.sequenceLength,
            ]
        );

        // console.log(proteinResult);
        const { protein_id, created_at, updated_at } = proteinResult.rows[0];
        
        const sequenceUrl = `http://localhost:3000/api/proteins/${protein_id}/download`;

        await pool.query(`
            UPDATE proteins 
            SET sequence_url = $1
            WHERE protein_id = $2`,
            [
                sequenceUrl,
                protein_id
            ]
        )

        // Create and store fragments
        await fragmentAndStoreSequence(pool, protein_id, sequence);

        const isoCreatedDate = new Date(created_at).toISOString();
        const isoUpdatedDate = new Date(updated_at).toISOString();

        // Commit transaction
        await pool.query('COMMIT');
        return { protein_id, isoCreatedDate, isoUpdatedDate, sequenceUrl };
    } catch (error) {
        // Rollback in case of any error
        await pool.query('ROLLBACK');
        console.error('Transaction failed:', error);
        throw new Error("Fail to create protein with fragments");
    }
}

// Fragment a protein sequence and store fragments
async function fragmentAndStoreSequence(pool, proteinId, sequence) {
    // Configuration for sliding window approach
    const windowSize = 15;
    const stepSize = 5;

    try {
        // 1. Iterate through sequence with sliding window
        for (let i = 0; i < sequence.length - windowSize + 1; i += stepSize) {
            // 2. Extract fragment
            const fragment = sequence.slice(i, i + windowSize);

            // 3. Analyze fragment characteristics
            const secondaryStructure = predictSecondaryStructure(fragment);

            // 5. Prepare data for database storage
            const fragmentData = {
                protein_id: proteinId,
                fragment,
                secondary_structure: secondaryStructure,
            };

            // const protein_exist = await pool.query(
            //     "SELECT * FROM proteins WHERE protein_id = $1",
            //     [fragmentData.protein_id]
            // );
            // console.log(protein_exist.rows);

            // 6. Execute database insertion
            const fragmentResult = await pool.query(
                `INSERT INTO fragments(protein_id, sequence, start_position, end_position, secondary_structure)
                 VALUES($1, $2, $3, $4, $5) RETURNING fragment_id`,
                [
                    fragmentData.protein_id,
                    fragmentData.fragment,
                    i,
                    i + windowSize,
                    fragmentData.secondary_structure,
                ]
            );
            const fragmentId = fragmentResult.rows[0].fragment_id;

            await pool.query(`
                UPDATE fragments 
                SET url = $1
                WHERE fragment_id = $2`,
                [
                    `http://localhost:3000/api/fragments/${fragmentId}`,
                    fragmentId
                ]
            )

            // 4. Identify motifs in current fragment
            await identifyMotifs(pool, fragment, fragmentId);
        }

    } catch (error) {
        // 7. Handle errors appropriately
        console.error('Fragmentation error:', error.message);
        throw new Error("Fail to fragment and store squence"); // Allow transaction to handle rollback
    }
}

async function identifyMotifs(pool, fragment, fragment_id) {
    const motifs = {
        "N-glycosylation site": {
            pattern: /N[^P][ST][^P]/g,
            type: "N-glycosylation"
        },
        "Casein kinase II phosphorylation site": {
            pattern: /[ST].{2}[DE]/g,
            type: "Casein kinase II"
        },
        "Tyrosine kinase phosphorylation site": {
            pattern: /[RK].{0,2}[DE]/g,
            type: "Tyrosine kinase"
        }
    }

    try {
        for(const [name, { pattern, type }] of Object.entries(motifs)) {
            const match = pattern.exec(fragment);
            if(match !== null) {
                const start_position = match.index;
                const end_position = start_position + match[0].length;
                const confidence_score = calculateConfidenceScore(fragment);

                let total = 0;
                for(const e of confidence_score) {
                    total += e;
                }

                total /= confidence_score.length;


                const motifResult = await pool.query(
                    `INSERT INTO motifs(fragment_id, motif_pattern, motif_type, start_position, end_position, confidence_score)
                     VALUES($1, $2, $3, $4, $5, $6) RETURNING motif_id`,
                    [
                        fragment_id,
                        match[0],
                        name,
                        start_position,
                        end_position,
                        total
                    ]
                )
            }
        }
    } catch (error) {
        console.error('Motif identification error:', error.message);
        throw error;
    }
}

async function getUpdatedFragmentData(pool, fragmentData) {
    const updatedFragmentData = await Promise.all(
        fragmentData.rows.map(async (fragment) => ({
            fragmentId: fragment.fragment_id,
            proteinId: fragment.protein_id,
            sequence: fragment.sequence,
            startPosition: fragment.start_position,
            endPosition: fragment.end_position,
            motifs: await getMotifs(pool, fragment.fragment_id),
            secondaryStructure: fragment.secondary_structure,
            confidenceScores: calculateConfidenceScore(fragment.sequence),
            createdAt: fragment.created_at,
            url: fragment.url
        }))
    );

    return updatedFragmentData;
}

async function getMotifs(pool, fragmentId) {
    try {
        const motifData = await pool.query(`
            SELECT DISTINCT m.motif_type
            FROM motifs m
            INNER JOIN fragments f ON m.fragment_id = f.fragment_id
            WHERE f.fragment_id = $1;`,
            [fragmentId]
        )
        
        // console.log(motifData.rows);

        return motifData.rows.map(row => row.motif_type);

    } catch (error) {
        throw new Error('Failed to retrieve motifs');
    }
}

module.exports = { 
    generateProteinName, 
    calculateMolecularWeight, 
    predictSecondaryStructure, 
    generateStructureSVG, 
    authenticateUser, 
    createProteinWithFragments, 
    getUpdatedFragmentData,
    getMotifs
};