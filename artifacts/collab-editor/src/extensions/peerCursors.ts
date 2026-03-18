import { StateEffect, StateField, Range, Extension } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';

export interface PeerCursorData {
  userId: string;
  userName: string;
  color: string;
  position: number;
  lastUpdate: number;
}

export const setCursorEffect = StateEffect.define<PeerCursorData>();
export const removeCursorEffect = StateEffect.define<string>();
export const clearCursorsEffect = StateEffect.define<null>();

class CursorWidget extends WidgetType {
  constructor(readonly data: PeerCursorData) {
    super();
  }

  toDOM(): HTMLElement {
    const isActive = Date.now() - this.data.lastUpdate < 2600;

    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:relative;display:inline-block;pointer-events:none;';

    const line = document.createElement('span');
    line.className = 'peer-caret-line';
    line.style.setProperty('--peer', this.data.color);
    line.style.opacity = isActive ? '1' : '0.45';

    const glow = document.createElement('span');
    glow.className = 'peer-caret-glow';
    glow.style.setProperty('--peer', this.data.color);
    glow.style.opacity = isActive ? '1' : '0.35';

    const label = document.createElement('span');
    label.className = 'peer-caret-label';
    label.style.setProperty('--peer', this.data.color);
    label.textContent = this.data.userName;
    label.style.opacity = isActive ? '1' : '0.5';

    wrap.appendChild(glow);
    wrap.appendChild(line);
    wrap.appendChild(label);
    return wrap;
  }

  eq(other: CursorWidget): boolean {
    return (
      other.data.userId === this.data.userId &&
      other.data.position === this.data.position &&
      Math.floor(other.data.lastUpdate / 180) === Math.floor(this.data.lastUpdate / 180)
    );
  }

  ignoreEvent(): boolean {
    return true;
  }
}

export const peerCursorField = StateField.define<Map<string, PeerCursorData>>({
  create() {
    return new Map();
  },

  update(cursors, tr) {
    let next = cursors;

    if (tr.docChanged && cursors.size > 0) {
      next = new Map();
      for (const [id, c] of cursors) {
        const newPos = Math.min(tr.changes.mapPos(c.position, 1), tr.newDoc.length);
        next.set(id, { ...c, position: newPos });
      }
    }

    for (const effect of tr.effects) {
      if (effect.is(setCursorEffect)) {
        if (next === cursors) next = new Map(cursors);
        next.set(effect.value.userId, effect.value);
      } else if (effect.is(removeCursorEffect)) {
        if (next === cursors) next = new Map(cursors);
        next.delete(effect.value);
      } else if (effect.is(clearCursorsEffect)) {
        if (next.size > 0) next = new Map();
      }
    }

    return next;
  },

  provide(field) {
    return EditorView.decorations.from(field, (cursors) => {
      const widgets: Range<Decoration>[] = [];
      for (const cursor of cursors.values()) {
        widgets.push(Decoration.widget({ widget: new CursorWidget(cursor), side: 1 }).range(cursor.position));
      }
      widgets.sort((a, b) => a.from - b.from);
      try {
        return Decoration.set(widgets);
      } catch {
        return Decoration.none;
      }
    });
  },
});

export const peerCursorsExtension: Extension = [peerCursorField];
