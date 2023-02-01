import * as _Plotly from 'plotly.js-dist-min';

// Without the "export type Plotly = typeof _Plotly;", the TypeScript compiler
// seems to complain.

export type Plotly = typeof _Plotly;
//export const Plotly = _Plotly;

export type PlotlyInstance = typeof _Plotly;

export interface Figure {
    data: _Plotly.Data[];
    layout: Partial<_Plotly.Layout>;
    frames: Partial<_Plotly.Config>;
}
