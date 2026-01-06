// Small date utilities to avoid timezone-related off-by-one issues.
export function toYMD(dateLike){
  if(!dateLike) return '';
  // If already in YYYY-MM-DD format, return it
  if(/^\d{4}-\d{2}-\d{2}$/.test(dateLike)) return dateLike;
  // Firestore Timestamp-like
  if(typeof dateLike === 'object' && typeof dateLike.toDate === 'function'){
    const d = dateLike.toDate();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  const d = new Date(dateLike);
  if(isNaN(d)) return String(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function ymdToDate(ymd){
  if(!ymd) return null;
  const parts = String(ymd).split('-');
  if(parts.length < 3) return new Date(ymd);
  const y = Number(parts[0]), m = Number(parts[1]) - 1, d = Number(parts[2]);
  return new Date(y, m, d);
}

export function displayDateFromYMD(ymd){
  const dt = ymdToDate(ymd);
  if(!dt) return '';
  return dt.toLocaleDateString();
}

export function formatDateShortFromYMD(ymd){
  const dt = ymdToDate(ymd);
  if(!dt) return '';
  return dt.toLocaleDateString(undefined,{month:'short',day:'numeric'});
}
