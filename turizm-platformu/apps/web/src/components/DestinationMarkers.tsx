import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { resolveTypeMarkerIcon, typeMarkerDivIcon } from '../lib/markerIcons'

export interface MarkerDestination {
  id: string
  name: string
  latitude: number
  longitude: number
  typeName: string
  typeSlug?: string | null
  typeIcon?: string | null
  provinceName: string
  typeColor?: string | null
  shortDescription?: string | null
  popupHtml?: string
}

function buildLeafletIcon(dest: MarkerDestination) {
  const emoji = resolveTypeMarkerIcon({
    slug: dest.typeSlug,
    name: dest.typeName,
    icon: dest.typeIcon,
  })
  return L.divIcon({
    className: 'turizm-marker-wrap',
    html: typeMarkerDivIcon(emoji, dest.typeColor),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -14],
  })
}

export default function DestinationMarkers({
  destinations,
  onMarkerClick,
}: {
  destinations: MarkerDestination[]
  onMarkerClick?: (id: string) => void
}) {
  const map = useMap()

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 55,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => {
        const markers = cluster.getAllChildMarkers() as L.Marker[]
        const first = markers[0] as L.Marker & { options: { turizmEmoji?: string } }
        const emoji = first?.options?.turizmEmoji || '📍'
        return L.divIcon({
          className: 'turizm-marker-wrap',
          html: typeMarkerDivIcon(emoji, '#047857'),
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })
      },
    })

    destinations.forEach((dest) => {
      const emoji = resolveTypeMarkerIcon({
        slug: dest.typeSlug,
        name: dest.typeName,
        icon: dest.typeIcon,
      })
      const marker = L.marker([dest.latitude, dest.longitude], {
        icon: buildLeafletIcon(dest),
      }) as L.Marker & { options: { turizmEmoji?: string } }
      marker.options.turizmEmoji = emoji
      if (dest.popupHtml) marker.bindPopup(dest.popupHtml)
      marker.on('click', () => onMarkerClick?.(dest.id))
      group.addLayer(marker)
    })

    map.addLayer(group)
    return () => {
      map.removeLayer(group)
      group.clearLayers()
    }
  }, [destinations, map, onMarkerClick])

  return null
}
