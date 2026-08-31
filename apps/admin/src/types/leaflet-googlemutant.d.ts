// Types shim for `leaflet.gridlayer.googlemutant` — the package ships no
// declarations. Only the module-side effect (extending L.gridLayer) matters;
// our GoogleTileLayer casts to `any` at the call site because Leaflet's
// gridLayer factory function isn't extensible in the Leaflet type defs.
declare module 'leaflet.gridlayer.googlemutant'
