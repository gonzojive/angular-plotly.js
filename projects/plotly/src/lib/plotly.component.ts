/* tslint:disable component-selector no-output-native no-conflicting-lifecycle */

import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    OnChanges,
    OnInit,
    Output,
    SimpleChange,
    SimpleChanges,
    ViewChild,
    DoCheck,
    IterableDiffer,
    IterableDiffers,
    KeyValueDiffer,
    KeyValueDiffers,
} from '@angular/core';

import { PlotlyService } from './plotly.service';
import { Plotly } from './plotly.interface';
import * as PlotlyJS from 'plotly.js';

// @dynamic
@Component({
    selector: 'plotly-plot',
    template: `<div #plot [attr.id]="divId" [ngClass]="getClassName()" [ngStyle]="style">
      <ng-content></ng-content>
    </div>`,
    providers: [PlotlyService],
})
export class PlotlyComponent implements OnInit, OnChanges, OnDestroy, DoCheck {
    protected defaultClassName = 'js-plotly-plot';

    public plotlyInstance: PlotlyJS.PlotlyHTMLElement;
    public resizeHandler?: (instance: Plotly.PlotlyHTMLElement) => void;
    public layoutDiffer: KeyValueDiffer<string, any>;
    public dataDiffer: IterableDiffer<Plotly.Data>;

    @ViewChild('plot', { static: true }) plotEl: ElementRef;

    @Input() data?: Plotly.Data[];
    @Input() layout?: Partial<Plotly.Layout>;
    @Input() config?: Partial<Plotly.Config>;
    @Input() frames?: Partial<Plotly.Config>[];
    @Input() style?: { [key: string]: string };

    @Input() divId?: string;
    @Input() revision = 0;
    @Input() className?: string | string[];
    @Input() debug = false;
    @Input() useResizeHandler = false;

    @Input() updateOnLayoutChange = true;
    @Input() updateOnDataChange = true;
    @Input() updateOnlyWithRevision = false;

    @Output() initialized = new EventEmitter<Plotly.Figure>();
    @Output() update = new EventEmitter<Plotly.Figure>();
    @Output() purge = new EventEmitter<Plotly.Figure>();
    @Output() error = new EventEmitter<Error>();

    @Output() afterExport = new EventEmitter<void>();
    @Output() afterPlot = new EventEmitter<void>();
    @Output() animated = new EventEmitter<void>();
    @Output() animatingFrame = new EventEmitter<PlotlyJS.FrameAnimationEvent>();
    @Output() animationInterrupted = new EventEmitter<void>();
    @Output() autoSize = new EventEmitter<void>();
    @Output() beforeExport = new EventEmitter<PlotlyJS.BeforePlotEvent>();
    @Output() click = new EventEmitter<PlotlyJS.PlotMouseEvent>();
    @Output() plotlyClick = new EventEmitter<PlotlyJS.PlotMouseEvent>();
    @Output() clickAnnotation = new EventEmitter<PlotlyJS.ClickAnnotationEvent>();
    @Output() deselect = new EventEmitter<void>();
    @Output() doubleClick = new EventEmitter<void>();
    @Output() framework = new EventEmitter<void>();
    @Output() hover = new EventEmitter<PlotlyJS.PlotHoverEvent>();
    @Output() legendClick = new EventEmitter<PlotlyJS.LegendClickEvent>();
    @Output() legendDoubleClick = new EventEmitter<PlotlyJS.LegendClickEvent>();
    @Output() relayout = new EventEmitter<PlotlyJS.PlotRelayoutEvent>();
    @Output() restyle = new EventEmitter<PlotlyJS.PlotRestyleEvent>();
    @Output() redraw = new EventEmitter<void>();
    @Output() selected = new EventEmitter<PlotlyJS.PlotSelectionEvent>();
    @Output() selecting = new EventEmitter<PlotlyJS.PlotSelectionEvent>();
    @Output() sliderChange = new EventEmitter<PlotlyJS.SliderChangeEvent>();
    @Output() sliderEnd = new EventEmitter<PlotlyJS.SliderEndEvent>();
    @Output() sliderStart = new EventEmitter<PlotlyJS.SliderStartEvent>();
    @Output() transitioning = new EventEmitter<void>();
    @Output() transitionInterrupted = new EventEmitter<void>();
    @Output() unhover = new EventEmitter<PlotlyJS.PlotMouseEvent>();
    @Output() relayouting = new EventEmitter<PlotlyJS.PlotRelayoutEvent>();

    // Not part of @types/plotly.js.
    // @Output() buttonClicked = new EventEmitter<unknown>();
    // @Output() react = new EventEmitter<PlotlyJS.Rea>();
    // @Output() treemapclick = new EventEmitter<PlotlyJS.PlotTreemapclickEvent>();
    // @Output() sunburstclick = new EventEmitter<PlotlyJS.PlotSunburstclickEvent>();

    public eventNames = [
        'afterExport',
        'afterPlot',
        'animated',
        'animatingFrame',
        'animationInterrupted',
        'autoSize',
        'beforeExport',
        'clickAnnotation',
        'deselect',
        'doubleClick',
        'framework',
        'hover',
        'legendClick',
        'legendDoubleClick',
        'redraw',
        'relayout',
        'relayouting',
        'restyle',
        'selected',
        'selecting',
        'sliderChange',
        'sliderEnd',
        'sliderStart',
        'transitioning',
        'transitionInterrupted',
        'unhover',
        // Not part of @types/plotly.js.
        //'buttonClicked',
        //'react',
        //'sunburstclick',
        //'treemapclick',
    ];
    
    private typesafeEventNames = new Set(['hover']);

    constructor(
        public plotly: PlotlyService,
        public iterableDiffers: IterableDiffers,
        public keyValueDiffers: KeyValueDiffers,
    ) { }

    ngOnInit(): void {
        this.createPlot().then(() => {
            const figure = this.createFigure();
            this.initialized.emit(figure);
        });

        if (this.click.observers.length > 0) {
            const msg = 'DEPRECATED: Reconsider using `(plotlyClick)` instead of `(click)` to avoid event conflict. '
                + 'Please check https://github.com/plotly/angular-plotly.js#FAQ';
            console.error(msg);
        }
    }

    ngOnDestroy(): void {
        if (typeof this.resizeHandler === 'function') {
            this.getWindow().removeEventListener('resize', this.resizeHandler as any);
            this.resizeHandler = undefined;
        }

        const figure = this.createFigure();
        this.purge.emit(figure);
        PlotlyService.remove(this.plotlyInstance);
    }

    ngOnChanges(changes: SimpleChanges): void {
        let shouldUpdate = false;

        const revision: SimpleChange = changes.revision;
        if (revision && !revision.isFirstChange()) {
            shouldUpdate = true;
        }

        const debug: SimpleChange = changes.debug;
        if (debug && !debug.isFirstChange()) {
            shouldUpdate = true;
        }

        if (shouldUpdate) {
            this.updatePlot();
        }

        this.updateWindowResizeHandler();
    }

    ngDoCheck(): boolean | void {
        if (this.updateOnlyWithRevision) {
            return false;
        }

        let shouldUpdate = false;

        if (this.updateOnLayoutChange) {
            if (this.layoutDiffer) {
                const layoutHasDiff = this.layoutDiffer.diff(this.layout);
                if (layoutHasDiff) {
                    shouldUpdate = true;
                }
            } else if (this.layout) {
                this.layoutDiffer = this.keyValueDiffers.find(this.layout).create();
            } else {
                this.layoutDiffer = undefined;
            }
        }

        if (this.updateOnDataChange) {
            if (this.dataDiffer) {
                const dataHasDiff = this.dataDiffer.diff(this.data);
                if (dataHasDiff) {
                    shouldUpdate = true;
                }
            } else if (Array.isArray(this.data)) {
                this.dataDiffer = this.iterableDiffers.find(this.data).create(this.dataDifferTrackBy);
            } else {
                this.dataDiffer = undefined;
            }
        }

        if (shouldUpdate && this.plotlyInstance) {
            this.updatePlot();
        }
    }

    getWindow(): any {
        return window;
    }

    getClassName(): string {
        let classes = [this.defaultClassName];

        if (Array.isArray(this.className)) {
            classes = classes.concat(this.className);
        } else if (this.className) {
            classes.push(this.className);
        }

        return classes.join(' ');
    }

    createPlot(): Promise<void> {
        return this.plotly.newPlot(this.plotEl.nativeElement, this.data, this.layout, this.config, this.frames).then((plotlyInstance: PlotlyJS.PlotlyHTMLElement) => {
            this.plotlyInstance = plotlyInstance;
            this.getWindow().gd = this.debug ? plotlyInstance : undefined;

            plotlyInstance.on('plotly_afterexport', () => this.afterExport.emit());
            plotlyInstance.on('plotly_afterplot', () => this.afterPlot.emit());
            plotlyInstance.on('plotly_animated', () => this.animated.emit());
            plotlyInstance.on('plotly_animationinterrupted', () => this.animationInterrupted.emit());
            plotlyInstance.on('plotly_autosize', () => this.autoSize.emit());
            plotlyInstance.on('plotly_beforeexport', () => this.beforeExport.emit());
            plotlyInstance.on('plotly_deselect', () => this.deselect.emit());
            plotlyInstance.on('plotly_doubleclick', () => this.doubleClick.emit());
            plotlyInstance.on('plotly_framework', () => this.framework.emit());
            plotlyInstance.on('plotly_redraw', () => this.redraw.emit());
            plotlyInstance.on('plotly_transitioning', () => this.transitioning.emit());
            plotlyInstance.on('plotly_transitioninterrupted', () => this.transitionInterrupted.emit());

            plotlyInstance.on('plotly_hover', event => this.hover.emit(event));
            plotlyInstance.on('plotly_animatingframe', event => this.animatingFrame.emit(event));
            plotlyInstance.on('plotly_clickannotation', event => this.clickAnnotation.emit(event));
            plotlyInstance.on('plotly_hover', event => this.hover.emit(event));
            plotlyInstance.on('plotly_legendclick', event => { this.legendClick.emit(event); return false });
            plotlyInstance.on('plotly_legendclick', event => { this.legendDoubleClick.emit(event); return false });
            plotlyInstance.on('plotly_relayout', event => this.relayout.emit(event));
            plotlyInstance.on('plotly_relayouting', event => this.relayouting.emit(event));
            plotlyInstance.on('plotly_restyle', event => this.restyle.emit(event));
            plotlyInstance.on('plotly_selected', event => this.selected.emit(event));
            plotlyInstance.on('plotly_selecting', event => this.selecting.emit(event));
            plotlyInstance.on('plotly_sliderchange', event => this.sliderChange.emit(event));
            plotlyInstance.on('plotly_sliderend', event => this.sliderEnd.emit(event));
            plotlyInstance.on('plotly_sliderstart', event => this.sliderStart.emit(event));
            plotlyInstance.on('plotly_unhover', event => this.unhover.emit(event));


            plotlyInstance.on('plotly_click', (data: any) => {
                this.click.emit(data);
                this.plotlyClick.emit(data);
            });

            this.updateWindowResizeHandler();
        }, err => {
            console.error('Error while plotting:', err);
            this.error.emit(err);
        });
    }

    createFigure(): Plotly.Figure {
        const p: any = this.plotlyInstance;
        const figure: Plotly.Figure = {
            data: p.data,
            layout: p.layout,
            frames: p._transitionData ? p._transitionData._frames : null
        };

        return figure;
    }

    updatePlot(): Promise<any> {
        if (!this.plotlyInstance) {
            const error = new Error(`Plotly component wasn't initialized`);
            this.error.emit(error);
            throw error;
        }

        const layout = { ...this.layout };

        return this.plotly.update(this.plotlyInstance, this.data, layout, this.config, this.frames).then(() => {
            const figure = this.createFigure();
            this.update.emit(figure);
        }, err => {
            console.error('Error while updating plot:', err);
            this.error.emit(err);
        });
    }

    updateWindowResizeHandler(): void {
        if (this.useResizeHandler) {
            if (this.resizeHandler === undefined) {
                this.resizeHandler = () => this.plotly.resize(this.plotlyInstance);
                this.getWindow().addEventListener('resize', this.resizeHandler as any);
            }
        } else {
            if (typeof this.resizeHandler === 'function') {
                this.getWindow().removeEventListener('resize', this.resizeHandler as any);
                this.resizeHandler = undefined;
            }
        }
    }

    dataDifferTrackBy(_: number, item: any): unknown {
        const obj = Object.assign({}, item, { uid: '' });
        return JSON.stringify(obj);
    }
}
