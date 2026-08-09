export {};

// @types/leaflet@1.9.x ships `control.zoom/attribution/layers/scale` but omits
// the generic base factory that Leaflet itself exports at runtime.
declare global {
    namespace L {
        function control(options?: ControlOptions): Control;
    }
}
