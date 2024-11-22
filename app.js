import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import pkg from "pg"; // Import the entire pg module
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import connectPgSimple from "connect-pg-simple"; // Import PgSession
import session from "express-session";

// Destructure Client and Pool from the pg module
const { Client, Pool } = pkg;

// Load environment variables
dotenv.config();

// Define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Session store using PostgreSQL
const PgSession = connectPgSimple(session);

// Initialize express app
const app = express();
app.set("view engine", "ejs");
app.set("views", join(__dirname, "views")); // Set views directory

// Initialize PostgreSQL client
const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Connect to the database
db.connect(err => {
    if (err) {
        console.error("Could not connect to the database", err);
    } else {
        console.log("Connected to the database");
    }
});

// Initialize PostgreSQL pool
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Ensure the `book_notes` table exists
// Ensure the `book_notes` table exists
const ensureBookNotesTable = async () => {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS book_notes (
            id SERIAL PRIMARY KEY,
            image_path TEXT,
            read_date DATE,
            title VARCHAR(255) NOT NULL,
            book_rating INTEGER,
            takeaways TEXT,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    // Drop the trigger if it already exists and recreate it
    const createTriggerQuery = `
        DO $$
        BEGIN
            -- Check if the trigger already exists
            IF EXISTS (
                SELECT 1 
                FROM pg_trigger 
                WHERE tgname = 'set_updated_at'
            ) THEN
                -- Drop the existing trigger
                DROP TRIGGER set_updated_at ON book_notes;
            END IF;

            -- Create or replace the function
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            -- Create the new trigger
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON book_notes
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END;
        $$;
    `;

    try {
        // Create the table
        await db.query(createTableQuery);
        console.log("Ensured 'book_notes' table exists.");

        // Create the trigger
        await db.query(createTriggerQuery);
        console.log("Ensured 'set_updated_at' trigger exists.");
    } catch (err) {
        console.error("Error ensuring 'book_notes' table exists:", err);
    }
};

// Ensure the `user_admin` table exists and seed default admin
const ensureUserAdminTable = async () => {
    const createUserAdminTableQuery = `
        CREATE TABLE IF NOT EXISTS user_admin (
            id SERIAL PRIMARY KEY,
            user_name VARCHAR(50) NOT NULL UNIQUE,
            user_password VARCHAR(50) NOT NULL
        );
    `;

    const seedAdminUserQuery = `
        INSERT INTO user_admin (user_name, user_password)
        VALUES ('thierry', '02')
        ON CONFLICT (user_name) DO NOTHING;
    `;

    try {
        // Create the `user_admin` table
        await db.query(createUserAdminTableQuery);
        console.log("Ensured 'user_admin' table exists.");

        // Seed the default admin user
        await db.query(seedAdminUserQuery);
        console.log("Seeded default admin user: thierry.");
    } catch (err) {
        console.error("Error ensuring `user_admin` table or seeding admin user:", err);
    }
};

// Call the functions to ensure tables
ensureBookNotesTable();
ensureUserAdminTable();


// Use session middleware
app.use(
    session({
        store: new PgSession({
            pool: pgPool,
            tableName: "session",
            createTableIfMissing: true,
        }),
        secret: process.env.SESSION_SECRET || "default_secret",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false },
    })
);

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "public"))); // Serve static files

// Multer setup for file uploads
const upload = multer({ dest: "public/uploads/" });

// Check authentication middleware
const checkAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect("/auth");
    }
    next();
};

// Routes

// Authentication Page
app.get("/auth", (req, res) => {
    res.render("Auth");
});

// Login for admin
app.post("/login", async (req, res) => {
    try {
        const { username, user_password } = req.body;
        const result = await db.query("SELECT * FROM user_admin WHERE user_name = $1", [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (user_password === user.user_password) {
                req.session.userId = user.id;
                return res.redirect("/");
            }
        }
        res.send("Invalid username or password");
    } catch (err) {
        console.error("Error during login:", err);
        res.status(500).send("Server error");
    }
});

// View all posts as admin
app.get("/", checkAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                id, image_path, TO_CHAR(read_date, 'Dy Mon DD YYYY') AS formatted_read_date,
                title, book_rating, takeaways, content, created_at, updated_at
            FROM book_notes 
            ORDER BY id DESC
        `);
        res.render("home", { books: result.rows });
    } catch (err) {
        console.error("Error retrieving data", err);
        res.status(500).send("Server error");
    }
});

// Render form to add a new book
app.get("/add", checkAuth, (req, res) => {
    res.render("newbook");
});

// Add a new book
app.post("/add", checkAuth, upload.single("image"), async (req, res) => {
    try {
        const { title, read_date, book_rating, takeaways, content } = req.body;
        const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

        await db.query(
            `INSERT INTO book_notes (title, read_date, book_rating, takeaways, content, image_path) VALUES ($1, $2, $3, $4, $5, $6)`,
            [title, read_date, book_rating, takeaways, content, imagePath]
        );
        res.redirect("/");
    } catch (err) {
        console.error("Error inserting data", err);
        res.status(500).send("Server error");
    }
});

// Get a specific book by ID
app.get("/read/:id", checkAuth, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM book_notes WHERE id = $1", [req.params.id]);
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
        const result = await db.query("SELECT * FROM book_notes WHERE id = $1", [req.params.id]);
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

// Update an existing book
app.post("/update/:id", checkAuth, upload.single("image"), async (req, res) => {
    try {
        const { title, read_date, book_rating, takeaways, content, existingImagePath } = req.body;
        let imagePath = existingImagePath;
        if (req.file) {
            imagePath = `/uploads/${req.file.filename}`;
        }

        await db.query(
            `UPDATE book_notes SET title=$1, read_date=$2, book_rating=$3, takeaways=$4, content=$5, image_path=$6 WHERE id=$7`,
            [title, read_date, book_rating, takeaways, content, imagePath, req.params.id]
        );
        res.redirect("/");
    } catch (err) {
        console.error("Error updating book", err);
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




// User home page
app.get("/home", async (req, res) => {
    try {
        const result = await pgPool.query(`
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


// Start the server
const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
