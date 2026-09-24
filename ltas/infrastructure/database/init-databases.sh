#!/bin/sh
set -eu
# Generated passwords are hexadecimal; reject unsafe interpolation in SQL.
for value in "$MYSQL_APP_PASSWORD" "$MYSQL_MIGRATION_PASSWORD" "$MYSQL_WORKER_PASSWORD" "$KEYCLOAK_DB_PASSWORD"; do
  case "$value" in ''|*[!a-f0-9]*) echo 'Use the local environment generator for database passwords.' >&2; exit 1;; esac
  [ "${#value}" -eq 64 ] || exit 1
done
export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"
mysql -uroot <<SQL
CREATE DATABASE ltas CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE keycloak CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'ltas_app'@'%' IDENTIFIED BY '$MYSQL_APP_PASSWORD';
CREATE USER 'ltas_worker'@'%' IDENTIFIED BY '$MYSQL_WORKER_PASSWORD';
CREATE USER 'ltas_migrator'@'%' IDENTIFIED BY '$MYSQL_MIGRATION_PASSWORD';
CREATE USER 'keycloak'@'%' IDENTIFIED BY '$KEYCLOAK_DB_PASSWORD';
GRANT ALL PRIVILEGES ON ltas.* TO 'ltas_migrator'@'%';
GRANT ALL PRIVILEGES ON keycloak.* TO 'keycloak'@'%';
SQL
# ltas_app and ltas_worker receive table grants only after migrations,
# from scripts/apply-runtime-grants.mjs (npm run db:migrate).
