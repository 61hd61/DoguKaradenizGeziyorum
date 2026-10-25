-- Ayrı kullanıcı veritabanı (master-prompt)
-- psql -U postgres -f init-users-database.sql

CREATE DATABASE trabzon_turizm_users;

\connect trabzon_turizm_users

-- Şema API açılışında da ensureUsersDatabaseSchema ile oluşturulur.
