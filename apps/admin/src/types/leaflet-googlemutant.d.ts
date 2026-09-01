// Types shim for `leaflet.gridlayer.googlemutant` — the package ships no
// declarations. v0.16 is ESM-only and exports the class as `default`; it
// extends L.GridLayer so we get all Leaflet's layer methods (addTo, remove…)
// via the base class.
declare module 'leaflet.gridlayer.googlemutant/src/Leaflet.GoogleMutant.mjs' {
  import { GridLayer, GridLayerOptions } from 'leaflet'

  interface GoogleMutantOptions extends GridLayerOptions {
    type?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain'
    styles?: unknown[]
  }

  export default class GoogleMutant extends GridLayer {
    constructor(options?: GoogleMutantOptions)
  }
}
