export const metadata = {
  title: 'ESP32-C3-DevKitM-1 3D Preview',
  description: 'Preview the generated Berry 3D component asset and terminal anchors.',
}

/**
 * Route wrapper for the generated standalone ESP32-C3 3D preview.
 */
export default function Esp32C3DevKitPreviewPage() {
  return (
    <main style={{ height: '100vh', margin: 0 }}>
      <iframe
        title="ESP32-C3-DevKitM-1 3D Preview"
        src="/components/esp32-c3-devkitm-1/preview/index.html"
        style={{
          width: '100%',
          height: '100%',
          border: 0,
          display: 'block',
        }}
      />
    </main>
  )
}
