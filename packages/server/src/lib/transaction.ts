import { getDb } from "../db/index.js"

type Db = ReturnType<typeof getDb>

interface TransactionCapableDb {
  transaction?<T>(callback: (tx: Db) => Promise<T>): Promise<T>
}

export async function withTransaction<T>(
  db: Db,
  callback: (tx: Db) => Promise<T>,
): Promise<T> {
  const txDb = db as TransactionCapableDb
  if (typeof txDb.transaction !== "function") {
    return callback(db)
  }

  return txDb.transaction(callback)
}
