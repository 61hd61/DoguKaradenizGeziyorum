-- PostgreSQL initialization script
-- Runs automatically when container starts

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create database if not exists (handled by POSTGRES_DB env)
-- But we can set up additional configs

-- Set timezone
SET timezone = 'Europe/Istanbul';

-- Create indexes for better performance (will be created by Prisma migrations too)
-- This is just for reference

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE trabzon_turizm TO postgres;