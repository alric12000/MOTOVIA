import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc } from 'firebase/firestore'
import { db } from './firebase'

// Live subscription to a whole collection -> array of { id, ...data }.
export function useCollection(name) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, name),
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => { setError(err); setLoading(false) }
    )
    return unsub
  }, [name])
  return { data, loading, error }
}

// Live subscription to a single document.
export function useDoc(coll, id) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, coll, id), (snap) => {
      setData(snap.exists() ? { id: snap.id, ...snap.data() } : null)
      setLoading(false)
    })
    return unsub
  }, [coll, id])
  return { data, loading }
}

// Index an array of docs by id for O(1) lookup.
export function indexById(arr) {
  const m = {}
  for (const x of arr) m[x.id] = x
  return m
}
