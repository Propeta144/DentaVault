import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { MOUSE, TOUCH } from 'three'
import { CHART_ZOOM_LIMITS, focusChartTooth, resetChartCamera, zoomChartCamera } from '../../utils/chartCamera'

const ROTATE_BUTTONS = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }
const PAN_BUTTONS = { ...ROTATE_BUTTONS, LEFT: MOUSE.PAN }
const ROTATE_TOUCHES = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }
const PAN_TOUCHES = { ...ROTATE_TOUCHES, ONE: TOUCH.PAN }

export default function ChartCameraControls({ controlsRef, view, selectedTooth, autoFocus, panMode, action }) {
  const scene = useThree((state) => state.scene)
  const previousTooth = useRef(undefined)
  const previousAction = useRef(action)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const changedTooth = previousTooth.current !== selectedTooth
    previousTooth.current = selectedTooth
    const changedAction = action && previousAction.current !== action
    previousAction.current = action
    const command = changedAction ? action.type : changedTooth && autoFocus && selectedTooth ? 'focus' : null
    if (command === 'reset') resetChartCamera(controls, view)
    else if (command === 'in' || command === 'out') zoomChartCamera(controls, command === 'in' ? 1 / 1.25 : 1.25)
    else if (command === 'focus') {
      let tooth
      scene.traverse((object) => {
        if (object.userData.toothNumber === selectedTooth) tooth = object
      })
      focusChartTooth(controls, tooth)
    }
  }, [action, selectedTooth, autoFocus, controlsRef, scene, view])

  return <OrbitControls ref={controlsRef} target={view.target}
    enablePan screenSpacePanning zoomToCursor
    panSpeed={0.8} zoomSpeed={0.8}
    mouseButtons={panMode ? PAN_BUTTONS : ROTATE_BUTTONS}
    touches={panMode ? PAN_TOUCHES : ROTATE_TOUCHES}
    {...CHART_ZOOM_LIMITS} />
}
