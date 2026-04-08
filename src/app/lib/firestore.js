import {
  addDoc as firebaseAddDoc,
  collection as firebaseCollection,
  deleteDoc as firebaseDeleteDoc,
  doc as firebaseDoc,
  getDoc as firebaseGetDoc,
  getDocs as firebaseGetDocs,
  limit as firebaseLimit,
  orderBy as firebaseOrderBy,
  query as firebaseQuery,
  serverTimestamp as firebaseServerTimestamp,
  setDoc as firebaseSetDoc,
  updateDoc as firebaseUpdateDoc,
  where as firebaseWhere,
} from 'firebase/firestore'
import { db as appDb, isFirebaseConfigured } from '@/src/app/lib/firebase'

const DEMO_DB_KEY = 'lf_demo_firestore_v1'

function inBrowser() {
  return typeof window !== 'undefined'
}

function isDemoFirestore() {
  return !isFirebaseConfigured || Boolean(appDb?.__demo)
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value
}

function asPath(segments) {
  return segments
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join('/')
}

function splitPath(path) {
  return String(path || '')
    .split('/')
    .filter(Boolean)
}

function readState() {
  if (!inBrowser()) return { docs: {} }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(DEMO_DB_KEY) || '{}')
    if (parsed && typeof parsed === 'object' && parsed.docs && typeof parsed.docs === 'object') {
      return parsed
    }
    return { docs: {} }
  } catch {
    return { docs: {} }
  }
}

function writeState(nextState) {
  if (!inBrowser()) return
  window.localStorage.setItem(DEMO_DB_KEY, JSON.stringify(nextState))
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 20)
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function getField(data, fieldPath) {
  const pathParts = String(fieldPath || '').split('.')
  let current = data
  for (const part of pathParts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

function compareValues(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

function listCollectionDocs(state, collectionPath) {
  const docs = []
  const collectionSegments = splitPath(collectionPath)

  Object.entries(state.docs || {}).forEach(([path, data]) => {
    if (!path.startsWith(`${collectionPath}/`)) return

    const pathSegments = splitPath(path)
    if (pathSegments.length !== collectionSegments.length + 1) return

    docs.push({
      id: pathSegments[pathSegments.length - 1],
      path,
      data: clone(data),
    })
  })

  return docs
}

function applyConstraints(rows, constraints) {
  let result = [...rows]

  constraints
    .filter((item) => item?.__type === 'where')
    .forEach((constraint) => {
      result = result.filter((row) => {
        if (constraint.operator !== '==') return true
        return getField(row.data, constraint.field) === constraint.value
      })
    })

  const orderConstraints = constraints.filter((item) => item?.__type === 'orderBy')
  orderConstraints.forEach((constraint) => {
    result.sort((a, b) => {
      const base = compareValues(getField(a.data, constraint.field), getField(b.data, constraint.field))
      return constraint.direction === 'desc' ? -base : base
    })
  })

  const limitConstraint = constraints.find((item) => item?.__type === 'limit')
  if (limitConstraint && Number(limitConstraint.count) >= 0) {
    result = result.slice(0, Number(limitConstraint.count))
  }

  return result
}

function createDocSnapshot(record) {
  const cachedData = clone(record.data)
  return {
    id: record.id,
    ref: { __type: 'doc', path: record.path, id: record.id },
    exists: () => true,
    data: () => clone(cachedData),
  }
}

function createQuerySnapshot(records) {
  const docs = records.map((record) => createDocSnapshot(record))
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback) => docs.forEach(callback),
  }
}

export function collection(dbInstance, ...pathSegments) {
  if (!isDemoFirestore()) {
    return firebaseCollection(dbInstance, ...pathSegments)
  }

  return {
    __type: 'collection',
    path: asPath(pathSegments),
  }
}

export function doc(dbInstance, ...pathSegments) {
  if (!isDemoFirestore()) {
    return firebaseDoc(dbInstance, ...pathSegments)
  }

  const path = asPath(pathSegments)
  const segments = splitPath(path)

  return {
    __type: 'doc',
    path,
    id: segments[segments.length - 1] || '',
  }
}

export function where(field, operator, value) {
  if (!isDemoFirestore()) {
    return firebaseWhere(field, operator, value)
  }

  return {
    __type: 'where',
    field,
    operator,
    value,
  }
}

export function orderBy(field, direction = 'asc') {
  if (!isDemoFirestore()) {
    return firebaseOrderBy(field, direction)
  }

  return {
    __type: 'orderBy',
    field,
    direction,
  }
}

export function limit(count) {
  if (!isDemoFirestore()) {
    return firebaseLimit(count)
  }

  return {
    __type: 'limit',
    count,
  }
}

export function query(reference, ...constraints) {
  if (!isDemoFirestore()) {
    return firebaseQuery(reference, ...constraints)
  }

  return {
    __type: 'query',
    path: reference.path,
    constraints,
  }
}

export async function getDocs(reference) {
  if (!isDemoFirestore()) {
    return firebaseGetDocs(reference)
  }

  const state = readState()
  const collectionPath = reference?.__type === 'query' ? reference.path : reference.path
  const constraints = reference?.__type === 'query' ? reference.constraints : []
  const records = applyConstraints(listCollectionDocs(state, collectionPath), constraints)

  return createQuerySnapshot(records)
}

export async function getDoc(reference) {
  if (!isDemoFirestore()) {
    return firebaseGetDoc(reference)
  }

  const state = readState()
  const data = state.docs?.[reference.path]

  if (!data) {
    return {
      id: reference.id,
      ref: reference,
      exists: () => false,
      data: () => undefined,
    }
  }

  return createDocSnapshot({
    id: reference.id,
    path: reference.path,
    data,
  })
}

export async function setDoc(reference, data) {
  if (!isDemoFirestore()) {
    return firebaseSetDoc(reference, data)
  }

  const state = readState()
  state.docs[reference.path] = clone(data)
  writeState(state)
}

export async function updateDoc(reference, updates) {
  if (!isDemoFirestore()) {
    return firebaseUpdateDoc(reference, updates)
  }

  const state = readState()
  const current = state.docs[reference.path] || {}
  state.docs[reference.path] = {
    ...clone(current),
    ...clone(updates),
  }
  writeState(state)
}

export async function addDoc(reference, data) {
  if (!isDemoFirestore()) {
    return firebaseAddDoc(reference, data)
  }

  const id = createId()
  const path = `${reference.path}/${id}`
  const state = readState()
  state.docs[path] = clone(data)
  writeState(state)

  return {
    id,
    path,
  }
}

export async function deleteDoc(reference) {
  if (!isDemoFirestore()) {
    return firebaseDeleteDoc(reference)
  }

  const state = readState()
  delete state.docs[reference.path]
  writeState(state)
}

export function serverTimestamp() {
  if (!isDemoFirestore()) {
    return firebaseServerTimestamp()
  }

  return new Date().toISOString()
}
