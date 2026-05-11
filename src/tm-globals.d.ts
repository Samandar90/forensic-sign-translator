/**
 * Global type declarations for @teachablemachine/image
 * loaded via CDN <script> tag in index.html.
 * Exposes window.tmImage namespace.
 */
declare global {
  namespace tmImage {
    interface Prediction {
      className: string
      probability: number
    }

    interface CustomMobileNet {
      predict(
        input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
      ): Promise<Prediction[]>
      getTotalClasses(): number
    }

    function load(modelURL: string, metadataURL: string): Promise<CustomMobileNet>
  }
}

export {}
