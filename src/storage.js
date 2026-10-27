import { useState } from 'react';
export function useLocal(key, initial) {
  const [value, set] = useState(() => {try { const v=JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : initial; } catch {return initial;} });
  const [error, setError] = useState('');
  function update(next) { set(old => {const v=typeof next==='function'?next(old):next; try {localStorage.setItem(key, JSON.stringify(v));setError('');} catch {setError('Le stockage local est indisponible. Ces changements ne seront pas conservés.');} return v;}); }
  return [value,update,error];
}
