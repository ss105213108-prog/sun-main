const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const migrationDirectory = path.join(__dirname, '..', 'supabase', 'migrations');
const migrationName = fs.readdirSync(migrationDirectory)
  .find(name => name.endsWith('_create_game_saves.sql'));
const sql = fs.readFileSync(path.join(migrationDirectory, migrationName), 'utf8');

test('migration defines the approved one-save schema', () => {
  assert.match(sql, /create table public\.game_saves/i);
  assert.match(sql, /id uuid primary key default gen_random_uuid\(\)/i);
  assert.match(sql, /user_id uuid not null/i);
  assert.match(sql, /unique \(user_id\)/i);
  assert.match(sql, /references auth\.users \(id\)\s+on delete cascade/i);
  assert.match(sql, /save_data jsonb not null/i);
  assert.match(sql, /save_version smallint not null default 1/i);
  assert.match(sql, /created_at timestamptz not null/i);
  assert.match(sql, /updated_at timestamptz not null/i);
});

test('migration uses database-managed updated_at and revision', () => {
  assert.match(sql, /create function public\.set_game_saves_server_metadata\(\)/i);
  assert.match(sql, /new\.revision := old\.revision \+ 1/i);
  assert.match(sql, /new\.updated_at := statement_timestamp\(\)/i);
  assert.match(sql, /before update on public\.game_saves/i);
});

test('migration enables RLS with four owner policies', () => {
  assert.match(sql, /alter table public\.game_saves enable row level security/i);
  const operations = [...sql.matchAll(/create policy[\s\S]*?for (select|insert|update|delete)/gi)]
    .map(match => match[1].toLowerCase())
    .sort();
  assert.deepEqual(operations, ['delete', 'insert', 'select', 'update']);

  const ownerChecks = sql.match(/\(select auth\.uid\(\)\) = user_id/gi) ?? [];
  assert.equal(ownerChecks.length, 5, 'SELECT, INSERT, UPDATE USING/WITH CHECK, DELETE must check ownership');
});

test('migration grants no anonymous Data API access', () => {
  assert.match(sql, /revoke all on table public\.game_saves from anon, authenticated/i);
  assert.doesNotMatch(sql, /grant[\s\S]*?\bto anon\b/i);
});

test('repository foundation contains no privileged Supabase credential', () => {
  const files = [
    path.join(__dirname, '..', '.env.example'),
    path.join(__dirname, '..', 'js', 'lib', 'supabase-client.js'),
    path.join(migrationDirectory, migrationName)
  ];
  const contents = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');

  assert.doesNotMatch(contents, /sb_secret_[A-Za-z0-9_-]+/);
  assert.doesNotMatch(contents, /service[_-]?role/i);
  assert.doesNotMatch(contents, /postgres(?:ql)?:\/\//i);
});
