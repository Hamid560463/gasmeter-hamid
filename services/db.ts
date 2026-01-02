
import { neon } from '@neondatabase/serverless';
import { User, Industry, Reading, AppState } from '../types';

const DATABASE_URL = process.env.DATABASE_URL;
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

const initTables = async () => {
    if (!sql) return;
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT,
                full_name TEXT,
                role TEXT
            );
        `;
        await sql`
            CREATE TABLE IF NOT EXISTS industries (
                id TEXT PRIMARY KEY,
                name TEXT,
                subscription_id TEXT,
                city TEXT,
                address TEXT,
                meters TEXT,
                allowed_daily_consumption NUMERIC
            );
        `;
        await sql`
            CREATE TABLE IF NOT EXISTS readings (
                id TEXT PRIMARY KEY,
                industry_id TEXT,
                meter_id TEXT,
                timestamp BIGINT,
                value NUMERIC,
                image_url TEXT,
                recorded_by TEXT
            );
        `;
        await sql`
            CREATE TABLE IF NOT EXISTS assignments (
                username TEXT PRIMARY KEY,
                industries TEXT
            );
        `;
    } catch (e) {
        console.error("Initialization error:", e);
    }
};

initTables();

export const subscribe = (onData: (data: Partial<AppState>) => void) => {
    let isSubscribed = true;
    const pollInterval = 5000;

    const fetchData = async () => {
        if (!sql || !isSubscribed) return;
        try {
            const usersRaw = await sql`SELECT * FROM users`;
            const industriesRaw = await sql`SELECT * FROM industries`;
            const readingsRaw = await sql`SELECT * FROM readings ORDER BY timestamp DESC`;
            const assignmentsRaw = await sql`SELECT * FROM assignments`;

            const users = usersRaw.map((u: any) => ({
                id: u.id,
                username: u.username,
                password: u.password,
                fullName: u.full_name,
                role: u.role
            }));

            const industries = industriesRaw.map((i: any) => ({
                id: i.id,
                name: i.name,
                subscriptionId: i.subscription_id,
                city: i.city,
                address: i.address,
                allowedDailyConsumption: Number(i.allowed_daily_consumption),
                meters: JSON.parse(i.meters || '[]')
            }));

            const readings = readingsRaw.map((r: any) => ({
                id: r.id,
                industryId: r.industry_id,
                meterId: r.meter_id,
                timestamp: Number(r.timestamp),
                value: Number(r.value),
                imageUrl: r.image_url,
                recordedBy: r.recorded_by,
                isManual: false
            }));

            const pendingConfigs: Record<string, Industry[]> = {};
            assignmentsRaw.forEach((a: any) => {
                pendingConfigs[a.username] = JSON.parse(a.industries || '[]');
            });

            onData({ users, industries, readings: readings as Reading[], pendingConfigs });
        } catch (e) {
            console.error("Data Fetch Error:", e);
        }
    };

    fetchData();
    const timer = setInterval(fetchData, pollInterval);
    return () => { isSubscribed = false; clearInterval(timer); };
};

export const putItem = async (coll: string, item: any) => {
    if (!sql) return;
    try {
        if (coll === 'users') {
            await sql`
                INSERT INTO users (id, username, password, full_name, role)
                VALUES (${item.id}, ${item.username}, ${item.password}, ${item.fullName}, ${item.role})
                ON CONFLICT (id) DO UPDATE SET
                    username = EXCLUDED.username,
                    password = EXCLUDED.password,
                    full_name = EXCLUDED.full_name,
                    role = EXCLUDED.role
            `;
        } else if (coll === 'industries') {
            await sql`
                INSERT INTO industries (id, name, subscription_id, city, address, meters, allowed_daily_consumption)
                VALUES (${item.id}, ${item.name}, ${item.subscriptionId}, ${item.city}, ${item.address}, ${JSON.stringify(item.meters)}, ${item.allowedDailyConsumption})
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    subscription_id = EXCLUDED.subscription_id,
                    city = EXCLUDED.city,
                    address = EXCLUDED.address,
                    meters = EXCLUDED.meters,
                    allowed_daily_consumption = EXCLUDED.allowed_daily_consumption
            `;
        } else if (coll === 'readings') {
            await sql`
                INSERT INTO readings (id, industry_id, meter_id, timestamp, value, image_url, recorded_by)
                VALUES (${item.id}, ${item.industryId}, ${item.meterId}, ${item.timestamp}, ${item.value}, ${item.imageUrl || ''}, ${item.recordedBy || ''})
                ON CONFLICT (id) DO NOTHING
            `;
        }
    } catch (e) {
        console.error("Put Item Error:", e);
    }
};

export const deleteItem = async (coll: string, id: string) => {
    if (!sql) return;
    try {
        if (coll === 'readings') {
            await sql`DELETE FROM readings WHERE id = ${id}`;
        } else if (coll === 'users') {
            await sql`DELETE FROM users WHERE id = ${id}`;
        } else if (coll === 'industries') {
            await sql`DELETE FROM industries WHERE id = ${id}`;
        }
    } catch (e) {
        console.error("Delete Error:", e);
    }
};

export const bulkPutIndustries = async (industries: Industry[]) => {
    if (!sql) return;
    for (const ind of industries) {
        await putItem('industries', ind);
    }
};

export const savePendingConfig = async (username: string, industries: Industry[]) => {
    if (!sql) return;
    await sql`
        INSERT INTO assignments (username, industries)
        VALUES (${username}, ${JSON.stringify(industries)})
        ON CONFLICT (username) DO UPDATE SET
            industries = EXCLUDED.industries
    `;
};

export const hasConfig = () => !!sql;
