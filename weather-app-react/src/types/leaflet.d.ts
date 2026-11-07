/**
 * Leaflet 1.9 的最小类型声明。
 *
 * 项目没有安装 @types/leaflet，这里只声明 FarmlandMap 实际用到的成员，
 * 避免整包退化成 any。新增 Leaflet 用法时按需补充。
 */
declare module 'leaflet' {
  export interface LatLng {
    lat: number;
    lng: number;
  }

  export type LatLngTuple = [number, number];
  export type LatLngExpression = LatLngTuple | LatLng;
  export type PointTuple = [number, number];

  export interface LatLngBounds {}

  export interface MapOptions {
    zoomControl?: boolean;
    attributionControl?: boolean;
    scrollWheelZoom?: boolean;
  }

  export interface FitBoundsOptions {
    padding?: PointTuple;
    maxZoom?: number;
  }

  export interface LocateOptions {
    setView?: boolean;
    watch?: boolean;
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }

  export interface PanOptions {
    animate?: boolean;
  }

  export interface ZoomPanOptions {
    duration?: number;
  }

  export interface LeafletMouseEvent {
    latlng: LatLng;
    originalEvent: Event;
  }

  export interface LocationEvent {
    latlng: LatLng;
    accuracy?: number;
  }

  export interface LeafletEvent {}

  export interface DivIconOptions {
    className?: string;
    html?: string;
    iconSize?: PointTuple;
    iconAnchor?: PointTuple;
  }

  export interface Icon {}

  export interface TooltipOptions {
    permanent?: boolean;
    direction?: string;
    className?: string;
  }

  export interface Layer {
    addTo(map: Map | LayerGroup): this;
    remove(): this;
  }

  export interface TileLayer extends Layer {}

  export interface LayerGroup extends Layer {
    clearLayers(): this;
  }

  export interface PathOptions {
    color?: string;
    weight?: number;
    fillColor?: string;
    fillOpacity?: number;
    dashArray?: string;
    interactive?: boolean;
    radius?: number;
  }

  export interface InteractiveLayer extends Layer {
    bindTooltip(content: string, options?: TooltipOptions): this;
    on(event: 'click', handler: (event: LeafletMouseEvent) => void): this;
  }

  export interface Marker extends InteractiveLayer {
    setLatLng(latlng: LatLngExpression): this;
    setIcon(icon: Icon): this;
  }

  export interface Path extends InteractiveLayer {
    setStyle(options: PathOptions): this;
    bringToFront(): this;
  }

  export interface Circle extends Path {
    getBounds(): LatLngBounds;
  }

  export interface CircleMarker extends Path {}

  export interface Polygon extends Path {}

  export interface Polyline extends Path {}

  export interface MarkerOptions {
    icon?: Icon;
    title?: string;
    interactive?: boolean;
  }

  export interface Map {
    setView(center: LatLngExpression, zoom: number): this;
    removeLayer(layer: Layer): this;
    on(event: 'click', handler: (event: LeafletMouseEvent) => void): this;
    on(event: 'locationfound', handler: (event: LocationEvent) => void): this;
    on(event: 'locationerror', handler: (event: LeafletEvent) => void): this;
    fitBounds(bounds: LatLngBounds, options?: FitBoundsOptions): this;
    invalidateSize(): this;
    remove(): void;
    panTo(latlng: LatLngExpression, options?: PanOptions): this;
    stopLocate(): this;
    locate(options?: LocateOptions): this;
    flyTo(latlng: LatLngExpression, zoom: number, options?: ZoomPanOptions): this;
  }

  export interface Control {
    addTo(map: Map): this;
  }

  export interface TileLayerOptions {
    subdomains?: string | string[];
    maxZoom?: number;
    attribution?: string;
  }

  export interface ScaleOptions {
    metric?: boolean;
    imperial?: boolean;
    position?: string;
  }

  export interface LeafletStatic {
    map(element: HTMLElement, options?: MapOptions): Map;
    tileLayer(urlTemplate: string, options?: TileLayerOptions): TileLayer;
    control: {
      scale(options?: ScaleOptions): Control;
    };
    layerGroup(): LayerGroup;
    divIcon(options?: DivIconOptions): Icon;
    circle(latlng: LatLngExpression, options?: PathOptions): Circle;
    circleMarker(latlng: LatLngExpression, options?: PathOptions): CircleMarker;
    polygon(latlngs: LatLngExpression[], options?: PathOptions): Polygon;
    polyline(latlngs: LatLngExpression[], options?: PathOptions): Polyline;
    marker(latlng: LatLngExpression, options?: MarkerOptions): Marker;
    latLngBounds(latlngs: LatLngExpression[]): LatLngBounds;
    DomEvent: {
      stopPropagation(event: Event): void;
    };
  }

  const L: LeafletStatic;
  export default L;
}
