import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import pg from "pg"; // PostgreSQL client
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ip from "ip";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Session store using PostgreSQL
const PgSession = connectPgSimple(session);

// Initialize express app
const app = express();
app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views')); // Set views directory

// Database connection
let db;
if (!db) {


const pg = require('pg'); // Ensure you're importing 'pg'

const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false, // Allow self-signed certificates (useful for production hosts like Render)
    },
});

db.connect(err => {
    if (err) {
        console.error('Could not connect to the database', err);
    } else {
        console.log('Connected to the database');
    }
});


// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "public"))); // Serve static files

// Multer setup for file uploads
const upload = multer({ dest: "public/uploads/" });

// Session configuration using PostgreSQL store

// Check authentication middleware
const checkAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/auth');
    }
    next();
};

// Login for admin
app.post("/login", async (req, res) => {
    try {
        const { username, user_password } = req.body;
        const result = await db.query('SELECT * FROM user_admin WHERE user_name = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (user_password === user.user_password) {
                req.session.userId = user.id;
                return res.redirect('/');
            }
        }
        res.send('Invalid username or password');
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).send('Server error');
    }
});

// View all posts as admin
app.get("/", checkAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                id,
                image_path,
                TO_CHAR(read_date, 'Dy Mon DD YYYY') AS formatted_read_date,
                title,
                book_rating,
                takeaways,
                content,
                created_at,
                updated_at
            FROM 
                book_notes 
            ORDER BY 
                id DESC
        `);

        res.render("home", { books: result.rows });
    } catch (err) {
        console.error("Error retrieving data", err);
        res.status(500).send("Server error");
    }
});

// Render the form to add a new book
app.get("/add", checkAuth, (req, res) => {
    res.render("newbook");
});

// Get a specific book by ID
app.get("/read/:id", checkAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT   
                id,  
                image_path,  
                TO_CHAR(read_date, 'Dy Mon DD YYYY') AS formatted_read_date,  
                title,  
                book_rating,  
                takeaways,  
                content,  
                created_at,  
                updated_at  
            FROM   
                book_notes   
            WHERE   
                id = $1
        `, [req.params.id]);

        if (result.rows.length > 0) {
            res.render("show", { book: result.rows[0] });
        } else {
            res.status(404).send("Book not found");
        }
    } catch (err) {
        console.error("Error retrieving book", err);
        res.status(500).send("Server error");
    }
});

// Edit a book
app.get("/edit/:id", checkAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT   
                id,  
                image_path,  
                TO_CHAR(read_date, 'Dy Mon DD YYYY') AS formatted_read_date,  
                title,  
                book_rating,  
                takeaways,  
                content,  
                created_at,  
                updated_at  
            FROM   
                book_notes   
            WHERE   
                id = $1
        `, [req.params.id]);

        if (result.rows.length > 0) {
            res.render("edit", { book: result.rows[0] });
        } else {
            res.status(404).send("Book not found");
        }
    } catch (err) {
        console.error("Error retrieving book", err);
        res.status(500).send("Server error");
    }
});

// Add a new book
app.post("/add", checkAuth, upload.single("image"), async (req, res) => {
    try {
        const { title, read_date, book_rating, takeaways, content } = req.body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

        await db.query(`
            INSERT INTO book_notes 
                (title, read_date, book_rating, takeaways, content, image_path) 
            VALUES 
                ($1, $2, $3, $4, $5, $6)
        `, [title, read_date, book_rating, takeaways, content, imagePath]);

        res.redirect("/");
    } catch (err) {
        console.error("Error inserting data", err);
        res.status(500).send("Server error");
    }
});

// Delete a book
app.post("/delete/:id", checkAuth, async (req, res) => {
    try {
        const result = await db.query("DELETE FROM book_notes WHERE id = $1", [req.params.id]);

        if (result.rowCount > 0) {
            res.redirect("/");
        } else {
            res.status(404).send("Book not found");
        }
    } catch (err) {
        console.error("Error during deletion:", err);
        res.status(500).send("Server error");
    }
});

// Update an existing book
app.post('/update/:id', checkAuth, upload.single("image"), async (req, res) => {  
    const bookId = parseInt(req.params.id, 10); // Convert to integer  

    if (isNaN(bookId)) {  
        return res.status(400).send("Invalid book ID");  
    }  

    // Destructure the request body  
    const { title, read_date, rating: book_rating, takeaways, content, existingImagePath } = req.body;  

    // Initialize imagePath with existing image  
    let imagePath = existingImagePath || "";  

    // Check if a new file was uploaded  
    if (req.file) {  
        imagePath = `/uploads/${req.file.filename}`; // Update to new image path if uploaded  
    }  

    try {  
        // Update the database  
        await db.query(`  
            UPDATE book_notes  
            SET title = \$1, read_date = \$2, book_rating = \$3, takeaways = \$4, content = \$5, image_path = \$6  
            WHERE id = \$7  
        `, [title, read_date, book_rating, takeaways, content, imagePath, bookId]);  

        // Redirect to home page after successful update  
        res.redirect("/");  

    } catch (error) {  
        console.error("Error updating the book:", error.message);  

        // Prepare the data to re-render the edit page with current values and error message  
        const book = {  
            id: bookId,  
            title: title || "",  
            read_date: read_date || null,  
            book_rating: book_rating || "",  
            takeaways: takeaways || "",  
            content: content || "",  
            image_path: existingImagePath || "", // Use existing image path in case of error  
        };  

        // Render the edit page with the error message  
        res.render("edit", {  
            book,  
            error: "An error occurred while updating the book. Please try again.",  
        });  
    }  
});

// Authentication page
app.get("/auth", (req, res) => {
    res.render("Auth");
});

// User home page
app.get("/home", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                id,
                image_path,
                TO_CHAR(read_date, 'Dy Mon DD YYYY') AS formatted_read_date,
                title,
                book_rating,
                takeaways,
                content,
                created_at,
                updated_at
            FROM 
                book_notes 
            ORDER BY 
                id DESC
        `);

        res.render("userhome", { books: result.rows });
    } catch (err) {
        console.error("Error retrieving data", err);
        res.status(500).send("Server error");
    }
});

// User read more page



app.get("/read/user/:id", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT   
                id,  
                image_path,  
                TO_CHAR(read_date, 'Dy Mon DD YYYY') AS formatted_read_date,  
                title,  
                book_rating,  
                takeaways,  
                content,  
                created_at,  
                updated_at  
            FROM   
                book_notes   
            WHERE   
                id = $1
        `, [req.params.id]);

        if (result.rows.length > 0) {
            res.render("usershow", { book: result.rows[0] });
        } else {
            res.status(404).send("Book not found");
        }
    } catch (err) {
        console.error("Error retrieving book", err);
        res.status(500).send("Server error");
    }
});

const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


