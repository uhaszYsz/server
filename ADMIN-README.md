# Database Admin Interface

A standalone HTML-based database administration tool for viewing and managing your SQLite databases.

## Features

- View all tables in your databases (users.db and sprites.db)
- Browse table contents with a user-friendly interface
- Execute custom SQL queries
- View query results in formatted tables
- Quick query buttons for common operations
- Safety warnings for destructive queries (DELETE, DROP, etc.)

## Setup

1. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

2. Make sure Express is installed:
   ```bash
   npm install express
   ```

## Running the Admin Server

### Windows:
```bash
start-admin-server.bat
```

### Linux/Mac:
```bash
chmod +x start-admin-server.sh
./start-admin-server.sh
```

### Or manually:
```bash
node admin-server.js
```

The admin server will start on port **8081**.

## Accessing the Interface

Open your web browser and navigate to:
```
http://localhost:8081
```

## Usage

1. **Select Database**: Choose which database to view (users.db or sprites.db)
2. **View Tables**: Click on any table name to view its contents
3. **Execute Queries**: 
   - Type SQL queries in the query textarea
   - Click "Execute Query" or use quick query buttons
   - For destructive queries (DELETE, DROP, etc.), you'll get a warning

## API Endpoints

- `GET /` - Serves the admin HTML interface
- `GET /api/db/:database/tables` - Get list of tables in a database
- `GET /api/db/:database/table/:tableName` - Get table data
- `POST /api/db/:database/query` - Execute SQL query

Where `:database` is either `users` or `sprites`.

## Important Notes

- The admin server uses separate database connections from the main server
- Make sure the main server has initialized the databases first (tables must exist)
- Be careful with destructive queries (DELETE, DROP, TRUNCATE, etc.)
- JSON fields are automatically parsed and displayed in a readable format
- The interface runs on port 8081 (configurable in admin-server.js)

## Troubleshooting

- **Port already in use**: Change `ADMIN_PORT` in admin-server.js to a different port
- **Database not found**: Make sure users.db and/or sprites.db exist in the server directory
- **Tables not showing**: Run the main server first to initialize the database tables
