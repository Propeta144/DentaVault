import { cleanShapes } from './drawAnnotations.js'

export function createAnnotationHistory(annotations) {
  return { shapes: cleanShapes(annotations), undone: [] }
}

// Undo puwede rin sa huling saved mark, gaya ng dating Remove last mark.
// Viewing session lang ang redo stack; annotations lang ang sine-save sa API.
export function annotationHistoryReducer(state, action) {
  if (action.type === 'add') {
    return { shapes: [...state.shapes, action.shape], undone: [] }
  }
  if (action.type === 'undo' && state.shapes.length) {
    return { shapes: state.shapes.slice(0, -1), undone: [...state.undone, state.shapes.at(-1)] }
  }
  if (action.type === 'redo' && state.undone.length) {
    return { shapes: [...state.shapes, state.undone.at(-1)], undone: state.undone.slice(0, -1) }
  }
  return state
}
