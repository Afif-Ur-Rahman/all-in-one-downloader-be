# Scripts Directory

This directory contains utility scripts for the AIO Downlaoder backend application.

## Quick Start

```bash
# See all available scripts
npm run script help

# Run admin user creation
npm run script create-admin-users

# Run cronjob manually
npm run script cronjob
```

## Dynamic Script Executor

### `dynamic-executor.ts`

A powerful script executor that automatically discovers and executes any script in the scripts directory.

#### Features

- **Automatic Discovery**: Automatically finds all executable scripts
- **Multiple File Types**: Supports `.ts`, `.js`, `.sh`, and `.py` files
- **Smart Execution**: Uses appropriate executor for each file type
- **Argument Passing**: Passes command line arguments to scripts
- **Help System**: Built-in help with script descriptions

#### Usage

```bash
# List all available scripts
npm run script help

# Execute a specific script
npm run script create-admin-users
npm run script cronjob

# Execute with arguments (if script supports them)
npm run script create-admin-users --verbose

# Run directly with ts-node
npx ts-node scripts/dynamic-executor.ts create-admin-users
npx ts-node scripts/dynamic-executor.ts help
```

#### Supported Script Types

- **`.ts`** → Executed with `ts-node` and `tsconfig-paths`
- **`.js`** → Executed with `node`
- **`.sh`** → Executed with `bash`
- **`.py`** → Executed with `python3`

#### Adding Script Descriptions

Add a description comment to your script files:

```typescript
// @description Your script description here
```

```bash
# @description Your script description here
```

```python
# @description Your script description here
```

## Admin User Migration

### `create-admin-users.ts`

This script creates the initial superadmin and admin users in the database.

#### Users Created

1. **Superadmin**
   - Email: Set via `SUPERADMIN_EMAIL` environment variable
   - Password: Set via `SUPERADMIN_PASSWORD` environment variable
   - Type: `superAdmin`

2. **Admin**
   - Email: Set via `ADMIN_EMAIL` environment variable
   - Password: Set via `ADMIN_PASSWORD` environment variable
   - Type: `admin`

#### Required Environment Variables

```env
# Admin Users Configuration
SUPERADMIN_EMAIL=operations.restaurants@gmail.com
SUPERADMIN_PASSWORD=Admin@123
ADMIN_EMAIL=neerajn64@gmail.com
ADMIN_PASSWORD=Test@1234

# Database Configuration
DB_URI=mongodb://localhost:27017/restaurant
```

#### Prerequisites

- MongoDB connection string must be set in `DB_URI` environment variable
- All dependencies must be installed (`yarn install`)
- Required environment variables must be set

#### Usage

Run the migration using the dynamic executor:

```bash
npm run script create-admin-users
```

Or run directly with ts-node:

```bash
npx ts-node -r tsconfig-paths/register scripts/create-admin-users.ts
```

#### Features

- **Environment-based Configuration**: Admin credentials are configured via environment variables
- **Idempotent**: Can be run multiple times safely
- **Duplicate Prevention**: Checks if users already exist before creating
- **Password Hashing**: Automatically hashes passwords using bcrypt
- **Error Handling**: Comprehensive error handling and logging
- **Status Reporting**: Shows current admin users after completion
- **Validation**: Validates required environment variables before proceeding

#### Output

The script provides detailed feedback:

- 📋 Environment variable status
- ✅ Success messages for each operation
- ⚠️ Warnings for existing users
- ❌ Error messages for failures
- 📋 Summary of current admin users

#### Environment Variables

Required:

- `DB_URI`: MongoDB connection string
- `SUPERADMIN_EMAIL`: Superadmin email address
- `SUPERADMIN_PASSWORD`: Superadmin password
- `ADMIN_EMAIL`: Admin email address
- `ADMIN_PASSWORD`: Admin password

Example:

```env
DB_URI=mongodb://localhost:27017/restaurant
SUPERADMIN_EMAIL=operations.restaurants@gmail.com
SUPERADMIN_PASSWORD=Admin@123
ADMIN_EMAIL=neerajn64@gmail.com
ADMIN_PASSWORD=Test@1234
```

## Available Scripts

All scripts can be executed using the dynamic executor:

### `create-admin-users.ts`

Creates initial superadmin and admin users in the database with environment-based configuration.

**Usage:** `npm run script create-admin-users`

### `cronjob.sh`

Automatically checks for git updates, installs dependencies, builds and restarts the application.

**Usage:** `npm run script cronjob` (or managed by PM2)

**Features:**

- Automatic git updates detection
- Dependency management
- Application rebuild
- PM2 integration

**Environment Variables:**

- `PROJECT_NAME`: Project name (defaults to "proj")
- `MODE`: Environment mode (defaults to "stag")

### `dynamic-executor.ts`

The core dynamic script executor that discovers and runs all scripts.

**Usage:** `npm run script help` (to see all available scripts)
