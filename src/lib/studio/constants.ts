/** localStorage key for persisted Studio projects. */
export const STUDIO_STORAGE_KEY = 'berry-studio-project'

/** localStorage key for the active browser-edited firmware source file. */
export const FIRMWARE_SOURCE_STORAGE_KEY = 'berry-studio-firmware-src-main-cpp'

/** Scene units → React Flow pixel scale. */
export const SCENE_SCALE = 640

/** React Flow node type id for catalog components. */
export const COMPONENT_NODE_TYPE = 'berryComponent' as const

/** React Flow edge type id for project wires. */
export const WIRE_EDGE_TYPE = 'berryWire' as const

/** localStorage key for component inspector panel width (px). */
export const INSPECTOR_WIDTH_STORAGE_KEY = 'berry-studio-inspector-width'

/** Default / min / max width for the component inspector (px). */
export const INSPECTOR_WIDTH_DEFAULT = 300
export const INSPECTOR_WIDTH_MIN = 260
export const INSPECTOR_WIDTH_MAX = 720
