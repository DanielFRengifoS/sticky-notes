import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  createRectFromDrag,
  hasReachedCreateThreshold,
  moveRect,
  resizeRect,
  toBoardPoint,
  type BoardBounds,
  type BoardPoint,
  type ClientPoint,
  type NoteRect,
} from './geometry';
import type { NoteId } from './notes';

export type BoardTool = 'select' | 'create';

type CancelReason = 'cancel' | 'unmount';

type Gesture =
  | { type: 'idle' }
  | {
      type: 'creating';
      pointerId: number;
      pointerOrigin: BoardPoint;
      boardBounds: BoardBounds;
    }
  | {
      type: 'moving';
      pointerId: number;
      noteId: NoteId;
      element: HTMLElement;
      pointerOrigin: BoardPoint;
      initialRect: NoteRect;
      boardBounds: BoardBounds;
    }
  | {
      type: 'resizing';
      pointerId: number;
      noteId: NoteId;
      element: HTMLElement;
      pointerOrigin: BoardPoint;
      initialRect: NoteRect;
      boardBounds: BoardBounds;
    };

export interface BoardGesturesParams {
  boardSurfaceRef: RefObject<HTMLDivElement | null>;
  tool: BoardTool;
  getNoteRect: (noteId: NoteId) => NoteRect | undefined;
  onInteractionStart: (noteId: NoteId) => void;
  onCommitRect: (noteId: NoteId, rect: NoteRect) => void;
  onCreateNote: (rect: NoteRect) => void;
  onDisarmCreateTool: () => void;
}

function isPrimaryLeftButton(event: PointerEvent<HTMLDivElement>): boolean {
  return event.isPrimary && event.button === 0;
}

function readBoardBounds(element: HTMLElement): BoardBounds {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function paintNoteElement(element: HTMLElement, from: NoteRect, to: NoteRect) {
  element.style.transform =
    to.x === from.x && to.y === from.y
      ? ''
      : `translate(${to.x - from.x}px, ${to.y - from.y}px)`;
  element.style.width = `${to.width}px`;
  element.style.height = `${to.height}px`;
}

export function useBoardGestures(params: BoardGesturesParams) {
  // handlers read params through this ref so their identity stays stable across renders
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  const gestureRef = useRef<Gesture>({ type: 'idle' });
  const captureTargetRef = useRef<HTMLElement | null>(null);

  const [creationPreview, setCreationPreview] = useState<NoteRect | null>(null);
  const [gestureActive, setGestureActive] = useState(false);

  function clearPreviewState() {
    setCreationPreview(null);
    setGestureActive(false);
  }

  function releaseCaptureIfHeld(pointerId: number) {
    const target = captureTargetRef.current;
    if (target !== null && target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    captureTargetRef.current = null;
  }

  const commitActiveGesture = useCallback(
    (pointerId: number, releasePoint: ClientPoint) => {
      const gesture = gestureRef.current;
      if (gesture.type === 'idle') return;
      if (gesture.pointerId !== pointerId) return;

      const releaseBoardPoint = toBoardPoint(releasePoint, gesture.boardBounds);
      const active = gesture;
      gestureRef.current = { type: 'idle' };
      if (active.type !== 'creating') {
        paintNoteElement(active.element, active.initialRect, active.initialRect);
      }

      switch (active.type) {
        case 'creating': {
          if (
            hasReachedCreateThreshold(active.pointerOrigin, releaseBoardPoint)
          ) {
            paramsRef.current.onCreateNote(
              createRectFromDrag(
                active.pointerOrigin,
                releaseBoardPoint,
                active.boardBounds,
              ),
            );
          }
          break;
        }
        case 'moving': {
          const rect = moveRect(
            active.initialRect,
            active.pointerOrigin,
            releaseBoardPoint,
            active.boardBounds,
          );
          paramsRef.current.onCommitRect(active.noteId, rect);
          break;
        }
        case 'resizing': {
          const rect = resizeRect(
            active.initialRect,
            active.pointerOrigin,
            releaseBoardPoint,
            active.boardBounds,
          );
          paramsRef.current.onCommitRect(active.noteId, rect);
          break;
        }
      }

      clearPreviewState();
      releaseCaptureIfHeld(pointerId);
    },
    [],
  );

  const cancelActiveGesture = useCallback((reason: CancelReason) => {
    const gesture = gestureRef.current;
    const capturedPointerId =
      gesture.type === 'idle' ? null : gesture.pointerId;
    gestureRef.current = { type: 'idle' };

    // on unmount the captured element is already going away, so releasing capture and
    // setting preview state are both wrong here
    if (reason === 'unmount') {
      captureTargetRef.current = null;
      return;
    }

    if (gesture.type === 'moving' || gesture.type === 'resizing') {
      paintNoteElement(gesture.element, gesture.initialRect, gesture.initialRect);
    }
    clearPreviewState();
    if (capturedPointerId !== null) {
      releaseCaptureIfHeld(capturedPointerId);
    } else {
      captureTargetRef.current = null;
    }
  }, []);

  function beginNoteGesture(
    noteId: NoteId,
    event: PointerEvent<HTMLDivElement>,
    buildGesture: (start: {
      element: HTMLElement;
      pointerOrigin: BoardPoint;
      initialRect: NoteRect;
      boardBounds: BoardBounds;
    }) => Gesture,
  ) {
    if (!isPrimaryLeftButton(event)) return;
    if (gestureRef.current.type !== 'idle') return;
    const boardSurface = paramsRef.current.boardSurfaceRef.current;
    if (boardSurface === null) return;
    const initialRect = paramsRef.current.getNoteRect(noteId);
    if (initialRect === undefined) return;
    const element = event.currentTarget.closest<HTMLElement>('.noteCard');
    if (element === null) return;

    event.stopPropagation();
    paramsRef.current.onInteractionStart(noteId);

    const boardBounds = readBoardBounds(boardSurface);
    const pointerOrigin = toBoardPoint(
      { clientX: event.clientX, clientY: event.clientY },
      boardBounds,
    );
    gestureRef.current = buildGesture({
      element,
      pointerOrigin,
      initialRect,
      boardBounds,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    captureTargetRef.current = event.currentTarget;
    setGestureActive(true);
  }

  const onHeaderPointerDown = useCallback(
    (noteId: NoteId, event: PointerEvent<HTMLDivElement>) => {
      beginNoteGesture(
        noteId,
        event,
        ({ element, pointerOrigin, initialRect, boardBounds }) => ({
          type: 'moving',
          pointerId: event.pointerId,
          noteId,
          element,
          pointerOrigin,
          initialRect,
          boardBounds,
        }),
      );
    },
    [],
  );

  const onResizePointerDown = useCallback(
    (noteId: NoteId, event: PointerEvent<HTMLDivElement>) => {
      beginNoteGesture(
        noteId,
        event,
        ({ element, pointerOrigin, initialRect, boardBounds }) => ({
          type: 'resizing',
          pointerId: event.pointerId,
          noteId,
          element,
          pointerOrigin,
          initialRect,
          boardBounds,
        }),
      );
    },
    [],
  );

  const onBoardPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (paramsRef.current.tool !== 'create') return;
      if (!isPrimaryLeftButton(event)) return;
      if (gestureRef.current.type !== 'idle') return;
      if (event.target !== event.currentTarget) return;
      const boardSurface = paramsRef.current.boardSurfaceRef.current;
      if (boardSurface === null) return;

      const boardBounds = readBoardBounds(boardSurface);
      const pointerOrigin = toBoardPoint(
        { clientX: event.clientX, clientY: event.clientY },
        boardBounds,
      );
      gestureRef.current = {
        type: 'creating',
        pointerId: event.pointerId,
        pointerOrigin,
        boardBounds,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      captureTargetRef.current = event.currentTarget;
      setGestureActive(true);
    },
    [],
  );

  const onBoardPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (gesture.type === 'idle') return;
      if (event.pointerId !== gesture.pointerId) return;
      const point = toBoardPoint(
        { clientX: event.clientX, clientY: event.clientY },
        gesture.boardBounds,
      );
      switch (gesture.type) {
        case 'creating':
          setCreationPreview(
            hasReachedCreateThreshold(gesture.pointerOrigin, point)
              ? createRectFromDrag(
                  gesture.pointerOrigin,
                  point,
                  gesture.boardBounds,
                )
              : null,
          );
          return;
        case 'moving':
          paintNoteElement(
            gesture.element,
            gesture.initialRect,
            moveRect(
              gesture.initialRect,
              gesture.pointerOrigin,
              point,
              gesture.boardBounds,
            ),
          );
          return;
        case 'resizing':
          paintNoteElement(
            gesture.element,
            gesture.initialRect,
            resizeRect(
              gesture.initialRect,
              gesture.pointerOrigin,
              point,
              gesture.boardBounds,
            ),
          );
          return;
      }
    },
    [],
  );

  const onBoardPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      commitActiveGesture(e.pointerId, {
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    [commitActiveGesture],
  );

  const onBoardPointerCancel = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (gesture.type === 'idle' || gesture.pointerId !== e.pointerId) {
        return;
      }
      cancelActiveGesture('cancel');
    },
    [cancelActiveGesture],
  );

  const onBoardLostPointerCapture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (gesture.type === 'idle' || gesture.pointerId !== event.pointerId) {
        return;
      }
      cancelActiveGesture('cancel');
    },
    [cancelActiveGesture],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (gestureRef.current.type !== 'idle') {
        cancelActiveGesture('cancel');
      }
      if (paramsRef.current.tool === 'create') {
        paramsRef.current.onDisarmCreateTool();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cancelActiveGesture]);

  useEffect(() => {
    return () => {
      cancelActiveGesture('unmount');
    };
  }, [cancelActiveGesture]);

  return {
    onBoardPointerDown,
    onHeaderPointerDown,
    onResizePointerDown,
    onBoardPointerMove,
    onBoardPointerUp,
    onBoardPointerCancel,
    onBoardLostPointerCapture,
    creationPreview,
    gestureActive,
  };
}
