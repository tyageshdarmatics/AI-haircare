import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' }); // <-- Load the configuration from the parent folder's .env file
const app = express();
app.use(express.json());
app.use(cors());

// Strip off any extra slashes or collection names the user might have accidentally added in .env
// We only need the base connection URL (e.g. mongodb://localhost:27017)
const rawUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const mongoUrl = rawUri.split('/Hair-analysis-database')[0];

const port = process.env.PORT || 5000;
const client = new MongoClient(mongoUrl);

let usersCollection;

const connectDB = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await client.connect();
      // Match the database name EXACTLY as shown in MongoDB Compass
      const db = client.db('Hair-analysis-database');
      // Match the collection name EXACTLY as shown in MongoDB Compass
      usersCollection = db.collection('Hair-analysis');
      console.log('✅ MongoDB connected! DB: Hair-analysis-database, Collection: Hair-analysis');
      return true;
    } catch (error) {
      console.error(`❌ MongoDB connection error (attempt ${i + 1}/${retries}):`, error.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
  console.error('❌ MongoDB connection failed after all retries');
  return false;
};

connectDB();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, email, phone, age } = req.body;

    if (!name || !email || !phone || !age) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = await usersCollection.insertOne({
      name,
      email,
      phone,
      age: parseInt(age),
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
    const users = await usersCollection.find({}).toArray();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/count', async (req, res) => {
  try {
    const count = await usersCollection.countDocuments({});
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
