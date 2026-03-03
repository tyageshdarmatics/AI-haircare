import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import serverless from 'serverless-http';

const app = express();
app.use(express.json());

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// MongoDB Atlas connection
// Added .trim() and stripped surrounding quotes in case they were accidentally included in the Netlify dashboard
const rawUri = process.env.MONGO_URI || '';
const MONGO_URI = rawUri.trim().replace(/^["']|["']$/g, '');
const DB_NAME = 'skincare-haircare-database';
const COLLECTION_NAME = 'users';

let cachedClient = null;
let usersCollection = null;

const connectDB = async () => {
    if (cachedClient && usersCollection) {
        return usersCollection;
    }
    if (!MONGO_URI || MONGO_URI === 'undefined' || MONGO_URI === 'null') {
        throw new Error('MONGO_URI environment variable is missing or literally "undefined" in Netlify settings.');
    }

    // Explicit scheme check to throw a much clearer error
    if (!MONGO_URI.startsWith('mongodb://') && !MONGO_URI.startsWith('mongodb+srv://')) {
        const prefix = MONGO_URI.substring(0, 15);
        throw new Error(`The MONGO_URI in Netlify has an invalid start value: "${prefix}...". It MUST start with "mongodb://" or "mongodb+srv://". Did you make a typo?`);
    }

    const client = new MongoClient(MONGO_URI, {
        serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    const db = client.db(DB_NAME);
    cachedClient = client;
    usersCollection = db.collection(COLLECTION_NAME);
    console.log(`✅ MongoDB connected! DB: ${DB_NAME}, Collection: ${COLLECTION_NAME}`);
    return usersCollection;
};

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: DB_NAME, collection: COLLECTION_NAME });
});

app.post('/api/users', async (req, res) => {
    try {
        const { name, email, phone, age } = req.body;

        if (!name || !email || !phone || !age) {
            return res.status(400).json({ error: 'All fields (name, email, phone, age) are required.' });
        }

        const collection = await connectDB();
        const result = await collection.insertOne({
            name,
            email,
            phone,
            age: parseInt(age, 10),
            createdAt: new Date(),
        });

        res.json({ success: true, id: result.insertedId });
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const collection = await connectDB();
        const users = await collection.find({}).sort({ createdAt: -1 }).toArray();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/count', async (req, res) => {
    try {
        const collection = await connectDB();
        const count = await collection.countDocuments({});
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export const handler = serverless(app);
