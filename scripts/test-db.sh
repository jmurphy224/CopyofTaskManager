#!/usr/bin/env bash
# Applies the database schema to a throwaway Postgres database and runs the
# permission tests. Needs psql and a Postgres server you can create databases on.
#   PGHOST=localhost PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-runsheet_test}"
dropdb --if-exists "$DB"
createdb "$DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/00_supabase_stub.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/migrations/0001_schema.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/rls_test.sql 2>&1 | grep -E "PASS|FAIL|ALL RLS|ERROR"
dropdb "$DB"
