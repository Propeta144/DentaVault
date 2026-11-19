import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { patientSearchFilter } from '../src/utils/patientSearch.js'
import { listPatients } from '../src/models/patientModel.js'
import pool from '../src/config/db.js'
import { list } from '../src/controllers/patients.controller.js'

// Execute the generated, portable name predicate against a temporary in-memory
// database. No credentials, external database, or patient records are used.
const db = new DatabaseSync(':memory:')
db.exec('CREATE TABLE patients (id INTEGER, first_name TEXT, last_name TEXT, deleted_at TEXT)')
const insert = db.prepare('INSERT INTO patients VALUES (?, ?, ?, ?)')
for (const row of [[1, 'Alice', 'Abad', null], [2, 'Bob', 'Santos', null], [3, 'Ana', 'Bautista', null],
  [4, 'Mary-Jane', 'Dela Cruz', null], [5, "O'Brien", 'Reyes', null], [6, 'Bobby', 'Deleted', '2026-11-19'],
  [7, 'Literal%_!', 'Name', null]]) insert.run(...row)

function matches(search, searchMode = 'name_prefix') {
  const { where, params } = patientSearchFilter({ search, searchMode })
  return db.prepare(`SELECT p.id FROM patients p ${where} ORDER BY p.id`).all(params).map((row) => row.id)
}

test('sidebar matches first-name and surname word prefixes, not letters inside another name', () => {
  assert.deepEqual(matches('b'), [2, 3])
  assert.deepEqual(matches('BO'), [2])
  assert.deepEqual(matches('abad'), [1])
  assert.deepEqual(matches('cruz'), [4])
  assert.deepEqual(matches('jane'), [4])
  assert.deepEqual(matches("o'b"), [5])
})

test('all typed name words must match, including surname-first input', () => {
  assert.deepEqual(matches('Cruz, Mary'), [4])
  assert.deepEqual(matches('mary   dela'), [4])
  assert.deepEqual(matches('Bob Bautista'), [])
})

test('wildcards and punctuation cannot turn a sidebar search into all patients', () => {
  assert.deepEqual(matches('%'), [])
  assert.deepEqual(matches('_'), [])
  assert.deepEqual(matches('literal%_!'), [7])
  assert.deepEqual(matches("' OR 1=1 --"), [])
  assert.deepEqual(matches(' , - . '), [])
  assert.deepEqual(matches(''), [1, 2, 3, 4, 5, 7])
})

test('the patient list and CSV retain their existing substring search', () => {
  assert.deepEqual(matches('b', null), [1, 2, 3, 5])
  // Explicit default: the helper does not treat unknown modes as prefix mode.
  assert.deepEqual(matches('b', 'other'), [1, 2, 3, 5])
})

test('patient rows and total use the same prefix filter before pagination', async (t) => {
  const calls = []
  t.mock.method(pool, 'execute', async (sql, params) => {
    calls.push({ sql, params })
    return calls.length === 1 ? [[{ id: 3 }]] : [[{ total: 1 }]]
  })
  const result = await listPatients({ search: 'b', searchMode: 'name_prefix', sort: 'name', limit: 8, offset: 0 })
  assert.deepEqual(result, { rows: [{ id: 3 }], total: 1 })
  assert.deepEqual(calls[0].params, calls[1].params)
  assert.equal(calls[0].sql.split('WHERE ')[1].split('ORDER BY')[0].trim(), calls[1].sql.split('WHERE ')[1].trim())
  assert.match(calls[0].sql, /LIMIT 8 OFFSET 0/)
  assert.match(calls[0].sql, /ORDER BY p.last_name ASC, p.first_name ASC/)
})

test('the HTTP controller forwards prefix mode to the database query', async (t) => {
  const calls = []
  t.mock.method(pool, 'execute', async (sql, params) => {
    calls.push({ sql, params })
    return calls.length === 1 ? [[{ id: 3 }]] : [[{ total: 1 }]]
  })
  const result = await new Promise((resolve, reject) => {
    list({ query: { search: 'b', searchMode: 'name_prefix', limit: '8' } }, { json: resolve }, reject)
  })
  assert.deepEqual(calls[0].params, { nameWord0: '% b%' })
  assert.equal(result.patients[0].id, 3)
  assert.equal(result.limit, 8)
})
