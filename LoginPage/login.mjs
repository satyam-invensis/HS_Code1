import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { stringToHash, verifyHash } from 'bcrypt-inzi';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(express.json());
app.use(cors());

// Determine current directory for static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../Frontend')));

const port = process.env.PORT || 3000; // Ensure this port is not conflicting

// MongoDB connection string
const dbURI = 'mongodb+srv://satyam149sharma:satyam2000@hscodes.78y8n.mongodb.net/HS_Codes?retryWrites=true&w=majority';

mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Mongoose is connected'))
    .catch(err => console.error('Mongoose connection error:', err));

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdOn: { type: Date, default: Date.now },
});

const userModel = mongoose.model('User', userSchema);

app.post('/signup', async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).send({
            message: 'Required fields missing',
            example: {
                firstName: 'John',
                lastName: 'Doe',
                email: 'abc@abc.com',
                password: '12345'
            }
        });
    }

    try {
        const existingUser = await userModel.findOne({ email }).exec();

        if (existingUser) {
            return res.status(400).send({ message: 'User already exists. Please try a different email.' });
        }

        const hashedPassword = await stringToHash(password);
        const newUser = new userModel({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password: hashedPassword
        });

        await newUser.save();
        res.status(201).send({ message: 'User created successfully.' });
    } catch (error) {
        res.status(500).send({ message: 'Internal server error.' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send({
            message: 'Required fields missing',
            example: {
                email: 'abc@abc.com',
                password: '12345'
            }
        });
    }

    try {
        const user = await userModel.findOne({ email }).exec();

        if (!user) {
            return res.status(404).send({ message: 'User not found.' });
        }

        const isPasswordValid = await verifyHash(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).send({ message: 'Incorrect password.' });
        }

        res.status(200).json({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            message: 'Login successful.',
            redirectUrl: 'http://localhost:5500/index.html' // Change to your frontend URL
        });
    } catch (error) {
        res.status(500).send({ message: 'Internal server error.' });
    }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
