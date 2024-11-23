import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import pkg from "pg"; // Import the entire pg module
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import connectPgSimple from "connect-pg-simple"; // Import PgSession
import session from "express-session";

const { Client, Pool } = pkg;

dotenv.config();

// Define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize PostgreSQL client
const db = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

db.connect(err => {
    if (err) console.error("Database connection error:", err);
    else console.log("Connected to database");
});

const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

// Ensure tables exist
const ensureTables = async () => {  
    const createBookNotesTable = `  
        CREATE TABLE IF NOT EXISTS book_notes (  
            id SERIAL PRIMARY KEY,  
            image_data BYTEA,  
            read_date DATE,  
            title VARCHAR(255) NOT NULL,  
            book_rating INTEGER,  
            takeaways TEXT,  
            content TEXT,  
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP  
        );  
    `;  

    const createUserAdminTable = `  
        CREATE TABLE IF NOT EXISTS user_admin (  
            id SERIAL PRIMARY KEY,  
            user_name VARCHAR(50) NOT NULL UNIQUE,  
            user_password VARCHAR(50) NOT NULL  
        );  
    `;  

    const seedAdminUser = `  
        INSERT INTO user_admin (user_name, user_password)  
        VALUES ('thierry', '02')  
        ON CONFLICT (user_name) DO NOTHING;  
    `;  

    // Trigger and function definition  
    const createTriggerFunction = `  
        CREATE OR REPLACE FUNCTION update_updated_at_column()  
        RETURNS TRIGGER AS $$  
        BEGIN  
            NEW.updated_at = CURRENT_TIMESTAMP;  
            RETURN NEW;  
        END;  
        $$ LANGUAGE plpgsql;  
    `;  

    const createTrigger = `  
        CREATE TRIGGER set_updated_at  
        BEFORE UPDATE ON book_notes  
        FOR EACH ROW  
        EXECUTE FUNCTION update_updated_at_column();  
    `;  

    try {  
        // Create tables  
        await db.query(createBookNotesTable);  
        await db.query(createUserAdminTable);  
        
        // Insert the admin user  
        await db.query(seedAdminUser);  
        
        // Create the function and trigger  
        await db.query(createTriggerFunction);  
        await db.query(createTrigger);  
        
        console.log("Tables ensured and admin seeded.");  
    } catch (err) {  
        console.error("Error ensuring tables:", err);  
    }  
};




// Express app setup
const app = express();
app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "public")));

// Multer for file uploads
const upload = multer();

// Session middleware
const PgSession = connectPgSimple(session);

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

// Authentication middleware
const checkAuth = (req, res, next) => {
    if (!req.session.userId) return res.redirect("/auth");
    next();
};

// Routes

// Authentication page
app.get("/auth", (req, res) => {
    res.render("Auth");
});

// Login logic
app.post("/login", async (req, res) => {
    const { username, user_password } = req.body;
    try {
        const result = await db.query("SELECT * FROM user_admin WHERE user_name = $1", [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            if (user_password === user.user_password) {
                req.session.userId = user.id;
                return res.redirect("/");
            }
        }
        res.status(401).send("Invalid username or password");
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).send("Server error");
    }
});

// Home page with list of notes
app.get("/", checkAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                id, TO_CHAR(read_date, 'Dy Mon DD YYYY') AS formatted_read_date,
                title, book_rating, takeaways, content, created_at, updated_at
            FROM book_notes
            ORDER BY id DESC
        `);
        res.render("home", { books: result.rows });
    } catch (err) {
        console.error("Error fetching notes:", err);
        res.status(500).send("Server error");
    }
});

// Add new book note
app.post("/add", checkAuth, upload.single("image"), async (req, res) => {
    const { title, read_date, book_rating, takeaways, content } = req.body;
    const imageBuffer = req.file ? req.file.buffer : null;
    try {
        await db.query(
            `INSERT INTO book_notes (title, read_date, book_rating, takeaways, content, image_data) 
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [title, read_date, book_rating, takeaways, content, imageBuffer]
        );
        res.redirect("/");
    } catch (err) {
        console.error("Error adding note:", err);
        res.status(500).send("Server error");
    }
});

// View specific book note
app.get("/read/:id", checkAuth, async (req, res) => {
    try {
        const result = await db.query("SELECT * FROM book_notes WHERE id = $1", [req.params.id]);
        if (result.rows.length > 0) {
            const book = result.rows[0];
            const imageBase64 = book.image_data
                ? `data:image/jpeg;base64,${book.image_data.toString("base64")}`
                : null;
            res.render("show", { book, imageBase64 });
        } else {
            res.status(404).send("Note not found");
        }
    } catch (err) {
        console.error("Error viewing note:", err);
        res.status(500).send("Server error");
    }
});

// Update a book note
app.post("/update/:id", checkAuth, upload.single("image"), async (req, res) => {
    const { title, read_date, book_rating, takeaways, content } = req.body;
    const imageBuffer = req.file ? req.file.buffer : null;
    try {
        await db.query(
            `UPDATE book_notes 
            SET title=$1, read_date=$2, book_rating=$3, takeaways=$4, content=$5, 
                image_data=COALESCE($6, image_data) 
            WHERE id=$7`,
            [title, read_date, book_rating, takeaways, content, imageBuffer, req.params.id]
        );
        res.redirect("/");
    } catch (err) {
        console.error("Error updating note:", err);
        res.status(500).send("Server error");
    }
});

// Delete a book note
app.post("/delete/:id", checkAuth, async (req, res) => {
    try {
        await db.query("DELETE FROM book_notes WHERE id = $1", [req.params.id]);
        res.redirect("/");
    } catch (err) {
        console.error("Error deleting note:", err);
        res.status(500).send("Server error");
    }
});


// Add a new book page
app.get("/add", checkAuth, (req, res) => {
    res.render("newbook");
});

// Edit a book page
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

// User home page
app.get("/home", async (req, res) => {
    try {
        const result = await pgPool.query(`
            SELECT 
                id,
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


// Server start
const PORT = process.env.PORT || 3009;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
