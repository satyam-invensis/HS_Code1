import express from 'express';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import cors from 'cors';
import { stringToHash, verifyHash } from 'bcrypt-inzi';

// Initialize Express app
const app = express();
const __dirname = path.resolve();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Set view engine and static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../Frontend'));
app.use(express.static(path.join(__dirname, '../Frontend')));

// CSV Data Handling
let csvData = [];
const csvFilePath = path.join(__dirname, 'data.csv');

function loadCSV(callback) {
    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => {
            let hsCode = data['hs code'] || '';
            data.Chapter = formatHeading(hsCode.substring(0, 2));
            data.Heading = formatHeading(hsCode.substring(0,4));
            data.Subheading = formatSubheading(hsCode.substring(0,6));
            data.Tarif = formatTarif(hsCode);
            data.DESCRIPTION = data.DESCRIPTION || 'N/A';
            csvData.push(data);
        })
        .on('end', () => {
            console.log('CSV data loaded successfully');
            callback(null);
        })
        .on('error', (err) => {
            console.error('Error reading CSV file:', err);
            callback(err);
        });
}

function formatHeading(heading) {
    if (heading.length >= 2) {
        return `${heading.slice(0, -2)}${heading.slice(-2)}`;
    }
    return heading;
}

function formatSubheading(subheading) {
    // Ensure subheading is a string and remove any whitespace
    subheading = subheading.trim();

    // Check if the length is appropriate for formatting
    if (subheading.length === 6) {
        // Format: 9403.91
        return `${subheading.slice(0, 4)}.${subheading.slice(4)}`;
    }

    // If not matching the expected length, return the original subheading
    return subheading;
}


function formatTarif(tarif) {
    // Ensure tarif is a string and remove any whitespace
    tarif = tarif.trim();

    // Check if the length is appropriate for formatting
    if (tarif.length === 10) {
        // Format: 9403.91.0090
        return `${tarif.slice(0, 4)}.${tarif.slice(4, 6)}.${tarif.slice(6)}`;
    }

    // If not matching the expected length, return the original tarif
    return tarif;
}


loadCSV((err) => {
    if (err) {
        console.error('Failed to load CSV data. Exiting...');
        process.exit(1);
    }
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});

// Routes for CSV Data Processing
app.get('/', (req, res) => {
    res.render('index');  // Render the homepage with the form
});

app.post('/predict', (req, res) => {
    try {
        const inputText = req.body.text ? req.body.text.trim().toLowerCase() : '';

        if (!inputText) {
            throw new Error('Input text is empty');
        }

        let predictions = predictFromCSV(inputText);

        if (predictions.length > 0) {
            res.render('result', { results: predictions, error: null, userInput: inputText });
        } else {
            res.render('result', { results: [], error: 'No matching results found.', userInput: inputText });
        }
    } catch (error) {
        console.error('Error during prediction:', error);
        res.status(500).render('result', { results: [], error: 'An error occurred. Please try again.', userInput: inputText });
    }
});

// Routes for Authentication
const dbURI = process.env.MONGODB_URI || 'mongodb+srv://satyam149sharma:satyam2000@hscodes.78y8n.mongodb.net/HS_Codes?retryWrites=true&w=majority';

mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Mongoose is connected'))
    .catch(err => {
        console.error('Mongoose connection error:', err);
        process.exit(1);
    });

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose is disconnected');
});

mongoose.connection.on('error', err => {
    console.error('Mongoose connection error:', err);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('App is terminating');
    mongoose.connection.close(() => {
        console.log('Mongoose default connection closed');
        process.exit(0);
    });
});

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
        return res.status(400).json({
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
            return res.status(400).json({ message: 'User already exists. Please try a different email.' });
        }

        const hashedPassword = await stringToHash(password);
        const newUser = new userModel({
            firstName,
            lastName,
            email: email.toLowerCase(),
            password: hashedPassword
        });

        await newUser.save();
        res.status(201).json({ message: 'User created successfully.' });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: 'Required fields missing',
            example: {
                email: 'abc@abc.com',
                password: '12345'
            }
        });
    }

    try {
        console.log(`Login attempt with email: ${email}`); // Log the email being queried

        // Find the user by email (case insensitive query)
        const user = await userModel.findOne({ email: email.toLowerCase() }).exec();

        if (!user) {
            console.log('User not found in the database'); // Log if user is not found
            return res.status(404).json({ message: 'User not found.' });
        }

        console.log('User found:', user); // Log the user details found

        const isPasswordValid = await verifyHash(password, user.password);

        if (!isPasswordValid) {
            console.log('Invalid password'); // Log if password is incorrect
            return res.status(401).json({ message: 'Incorrect password.' });
        }

        res.status(200).json({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            message: 'Login successful.',
            redirectUrl: '../Frontend/index.html'
        });
    } catch (error) {
        console.error('Error during login:', error); // Log any errors
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Utility functions
function predictFromCSV(text) {
    return csvData
        .filter(row => row.DESCRIPTION && row.DESCRIPTION.toLowerCase().includes(text.toLowerCase()))
        .map(row => ({
            chapter: row.Chapter || 'N/A',
            heading: row.Heading || 'N/A',
            subheading: row.Subheading || 'N/A',
            tarif: row.Tarif || 'N/A',
            description: row.DESCRIPTION || 'N/A'
        }))
        .sort((a, b) => b.tarif.localeCompare(a.tarif)) // Sort by tarif in descending order (if relevant)
        .slice(0, 8); // Get the top 8 entries
}
