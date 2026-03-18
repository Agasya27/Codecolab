const colors = [
  '#FF6B6B', 
  '#4ECDC4', 
  '#45B7D1', 
  '#96CEB4', 
  '#FFEAA7', 
  '#DDA0DD', 
  '#98D8C8', 
  '#F7B2BD'
];

export function colorFromId(id: string): string {
  if (!id) return colors[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase() || '??';
}
