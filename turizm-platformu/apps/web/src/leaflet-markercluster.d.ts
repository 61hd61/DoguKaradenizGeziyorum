import 'leaflet'

declare module 'leaflet' {
  interface MarkerClusterGroupOptions {
    maxClusterRadius?: number
  }

  class MarkerClusterGroup extends FeatureGroup {
    addLayer(layer: Layer): this
    clearLayers(): this
  }

  function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup

  namespace markerClusterGroup {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type MarkerClusterGroup = import('leaflet').MarkerClusterGroup
  }
}

declare module 'leaflet.markercluster' {}
