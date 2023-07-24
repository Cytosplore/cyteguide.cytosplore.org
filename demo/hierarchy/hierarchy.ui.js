function initContextMenu() {

    var cmenu = function (d) {

        var m = [];
        m.push({
            title: "Zoom into Cluster",
            action: function () {
                d3.select('.d3-context-menu').style('display', 'none');
                //log(d.data.maxIdx);
                if (isQtAvailable) Qt.js_drillIntoCluster(d.data.name, d.data.cName, d.data.cId, d.parent.data.name, d.data.maxIdx);
            }
        });

        if(m.length > 0 ) m.push({ divider: true });

        m.push({
            title: "Save Hierarchy as Image ...",
            action: printSVG
        });


        m.push({
            title: "Save Hierarchy as html ...",
            action: printJSON
        });

        return m;
    }

    return cmenu;
}

function initMarkerRangeSlider() {

    var slider = document.getElementById('markerRange');

    noUiSlider.create(slider, {
            start: [20, 80],
            behaviour: 'tap-drag',
            connect: true,
            range: {
                'min': 0,
                'max': 100
            },
            pips: {
                mode: 'positions',
                values: [0, 25, 50, 75, 100],
                density: 4
            }
    });
    return slider;
}

function rebuildRangeSlider() {

    _markerRangeSlider.noUiSlider.destroy();

    _markerUserBounds[0] = Math.max(_markerUserBounds[0], (_isVariationActive ? _variationRange[0] : _expressionRange[0]));
    _markerUserBounds[1] = Math.min(_markerUserBounds[1], (_isVariationActive ? _variationRange[1] : _expressionRange[1]));

    refreshColormap();

    var format = wNumb({ decimals: 2 })
    d3.select("#legendLabelBottom").text(format.to(_markerUserBounds[0]));
    d3.select("#legendLabelTop").text(format.to(_markerUserBounds[1]));

    noUiSlider.create(_markerRangeSlider, {
        start:_markerUserBounds,
        behaviour: 'tap-drag',
        connect: true,
        range: {
            'min': 0,
            'max': Math.max(_isVariationActive ? _variationRange[1] : _expressionRange[1], 5.0)
        },
        pips: {
            mode: 'positions',
            values: [0, 25, 50, 75, 100],
            density: 7,
            format: wNumb({
                decimals: 2
            })
        }
    });

    _markerRangeSlider.noUiSlider.on('slide', function (values, handle) {
        _markerUserBounds[handle] = parseFloat(values[handle]);
        refreshColormap();
        d3.select("#legendLabelBottom").text(format.to(_markerUserBounds[0]));
        d3.select("#legendLabelTop").text(format.to(_markerUserBounds[1]));

        // TODO: make this more efficient
        initLayout();
    });

    // TODO: make this more efficient
    initLayout();
}
