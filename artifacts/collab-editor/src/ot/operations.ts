export type OpType = 'insert' | 'delete';

export interface Operation {
  type: OpType;
  position: number;
  char?: string;
  userId: string;
  timestamp: number;
}

/**
 * Transform op1 against op2 with the given priority for tie-breaking.
 * Returns the adjusted op1, or null if it should be discarded (delete-delete same pos).
 *
 * Priority convention (mirrors server ot.ts):
 *  - 'right' means op1 shifts right when both are at the same position
 *  - 'left'  means op1 stays put
 */
export function transformOp(
  op1: Operation,
  op2: Operation,
  priority: 'left' | 'right'
): Operation | null {
  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op1.position === op2.position) {
      return priority === 'right'
        ? { ...op1, position: op1.position + 1 }
        : op1;
    }
    return op2.position <= op1.position
      ? { ...op1, position: op1.position + 1 }
      : op1;
  }

  if (op1.type === 'insert' && op2.type === 'delete') {
    return op2.position < op1.position
      ? { ...op1, position: op1.position - 1 }
      : op1;
  }

  if (op1.type === 'delete' && op2.type === 'insert') {
    return op2.position <= op1.position
      ? { ...op1, position: op1.position + 1 }
      : op1;
  }

  if (op1.type === 'delete' && op2.type === 'delete') {
    if (op1.position === op2.position) return null;
    return op2.position < op1.position
      ? { ...op1, position: op1.position - 1 }
      : op1;
  }

  return op1;
}

export function applyOp(document: string, op: Operation): string {
  if (op.type === 'insert' && op.char) {
    if (op.position > document.length) return document + op.char;
    return document.slice(0, op.position) + op.char + document.slice(op.position);
  } else if (op.type === 'delete') {
    if (op.position >= document.length) return document;
    return document.slice(0, op.position) + document.slice(op.position + 1);
  }
  return document;
}

export function applyOps(document: string, ops: Operation[]): string {
  let doc = document;
  // Sort by timestamp to ensure consistent application order in generic cases
  const sortedOps = [...ops].sort((a, b) => a.timestamp - b.timestamp);
  for (const op of sortedOps) {
    doc = applyOp(doc, op);
  }
  return doc;
}
