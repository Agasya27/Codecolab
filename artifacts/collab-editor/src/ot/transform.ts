import { Operation } from './operations';

export function transform(op1: Operation, op2: Operation, priority: 'left' | 'right'): Operation {
  const transformed = { ...op1 };

  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op1.position < op2.position) {
      // op1 is before op2, no change
    } else if (op1.position > op2.position) {
      transformed.position += op2.char!.length;
    } else {
      // same position
      if (priority === 'right') {
        transformed.position += op2.char!.length;
      }
    }
  } else if (op1.type === 'insert' && op2.type === 'delete') {
    if (op1.position <= op2.position) {
      // no change
    } else {
      transformed.position = Math.max(0, transformed.position - 1);
    }
  } else if (op1.type === 'delete' && op2.type === 'insert') {
    if (op1.position < op2.position) {
      // no change
    } else {
      transformed.position += op2.char!.length;
    }
  } else if (op1.type === 'delete' && op2.type === 'delete') {
    if (op1.position < op2.position) {
      // no change
    } else if (op1.position > op2.position) {
      transformed.position = Math.max(0, transformed.position - 1);
    } else {
      // both deleting same character, op is redundant. Represent by invalid position
      transformed.position = -1; 
    }
  }

  return transformed;
}

export function detectConflict(op1: Operation, op2: Operation): boolean {
  // Simple heuristic for conflicting intention (e.g. deleting same text, inserting at same point)
  return op1.position === op2.position && op1.userId !== op2.userId;
}
