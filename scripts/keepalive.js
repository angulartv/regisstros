const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is not defined.');
    process.exit(1);
}

const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function runKeepAlive() {
    try {
        await client.connect();
        console.log('Connected to database.');

        // 1. Check last execution time
        const res = await client.query(
            'SELECT created_at FROM keepalive_log ORDER BY created_at DESC LIMIT 1'
        );

        let shouldRun = false;
        let runReason = '';

        if (res.rows.length === 0) {
            shouldRun = true;
            runReason = 'First execution (no previous logs).';
        } else {
            const lastRun = new Date(res.rows[0].created_at);
            const now = new Date();
            const diffHours = (now - lastRun) / (1000 * 60 * 60);

            console.log(`Last run was ${diffHours.toFixed(2)} hours ago.`);

            if (diffHours >= 48) {
                shouldRun = true;
                runReason = '> 48 hours since last run.';
            } else {
                // Random chance (e.g., 25%) to simulate natural traffic
                if (Math.random() < 0.25) {
                    shouldRun = true;
                    runReason = 'Random execution triggered.';
                } else {
                    shouldRun = false;
                    runReason = 'Random execution skipped.';
                }
            }
        }

        // 2. Execute or Skip
        if (shouldRun) {
            console.log(`Executing keepalive: ${runReason}`);
            // Insert a new log entry
            await client.query('INSERT INTO keepalive_log DEFAULT VALUES');
            console.log('Keepalive log entry created.');
        } else {
            console.log(`Skipping keepalive: ${runReason}`);
        }

    } catch (err) {
        console.error('Error executing keepalive script:', err);
        process.exit(1);
    } finally {
        await client.end();
        console.log('Database connection closed.');
    }
}

runKeepAlive();
