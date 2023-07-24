// =============================================================================
// find out if the Qt object is available
// otherwise we are running in the browser
// =============================================================================
try {
    Qt.qt_setData.connect(setData);
    Qt.qt_addAvailableData.connect(addAvailableData);
    Qt.qt_setMarkerSelection.connect(setMarkerSelection);
    Qt.qt_setMarkerNames.connect(setMarkerNames);
} catch (error) {
    isQtAvailable = false;
    console.log("could not connect qt");
}

const _imageSize = 512;

var _markerRangeSlider = initMarkerRangeSlider();

var _data = null;
var _availableDataSets = [];

var _numMarkers;
var _isMarkerActive = [];
var _markerNames = [];

var _expressionRange = [0.0, 5.0];
var _variationRange = [0.0, 5.0];
var _markerUserBounds = [0.0, 5.0];

var _isVariationActive = true;
var _isSizeModeActive = false;

var _uniqueId = 0;

const _breadCrumbsHeight = 50;
const _navIconSize = 100;

const _idBarHeight = 8;
const _metaBarHeight = 20;
const _combinedBarHeight = _idBarHeight + _metaBarHeight;
const _margin = 10;

var _sunburstHeight = height - _breadCrumbsHeight;
var _radius = (Math.min(width, _sunburstHeight) / 2) - _combinedBarHeight - _margin;

var _xAxisScale = d3.scaleLinear()
    .range([0, circ])
    .clamp(true);

var _yAxisScale = d3.scaleLinear()
    .range([0, _radius])
    .domain([0,1])
    .clamp(true);

var _iconXAxisScale = d3.scaleLinear()
    .range([0, circ])
    .clamp(true);

var _iconYAxisScale = d3.scaleLinear()
    .range([0, _navIconSize / 2])
    .clamp(true);

var _containerSvg = d3.select("#mainView").append("svg")
    .attr("id", "container")
    .attr("width", width)
    .attr("height", _sunburstHeight);

var _breadCrumbsData = [];
var _breadCrumbsIds = [];
var _breadCrumbs = _containerSvg.append("g")
    .attr("id", "_breadCrumbs");

var _navIcon = _containerSvg.append("g")
    .attr("id", "_navIcon");

var _sunburst = _containerSvg.append("g")
    .attr("id", "_sunburst")
    .attr("transform", "translate(" + width / 2 + "," + (height / 2 + 2 * _margin) + ")");

var _partition = d3.partition();

var _tooltip = d3.select("#tooltip");
var _ttNumber = wNumb({
	decimals: 3,
});

_activeColormap = 12;

var arc = d3.arc()
    .startAngle(function (d) {
        return _xAxisScale(d.x0);
    })
    .endAngle(function (d) {
        return _xAxisScale(d.x1);
    })
    .innerRadius(function (d) {
        return (!d.data.image[0].length || _yAxisScale(d.y0) == 0) ? 0 : _yAxisScale(d.y0) + _combinedBarHeight;
    })
    .outerRadius(function (d) {
        return d.data.image[0].length ? _yAxisScale(d.y1) : 0;
    });

var iconArc = d3.arc()
    .startAngle(function (d) {
        return _iconXAxisScale(d.x0);
    })
    .endAngle(function (d) {
        return _iconXAxisScale(d.x1);
    })
    .innerRadius(function (d) {
        return _iconYAxisScale(d.y0);
    })
    .outerRadius(function (d) {
        return _iconYAxisScale(d.y1);
    });

var idArc = d3.arc()
    .startAngle(function (d) {
        return _xAxisScale(d.x0);
    })
    .endAngle(function (d) {
        return _xAxisScale(d.x1);
    })
    .innerRadius(function (d) {
        return _yAxisScale(d.y0);
    })
    .outerRadius(function (d) {
        return _yAxisScale(d.y0) == 0 ? 0 : _yAxisScale(d.y0) + _idBarHeight;
    })
    .cornerRadius(10);

var metaArc = d3.arc()
    .startAngle(function (d) {
        return _xAxisScale(d.x0);
    })
    .endAngle(function (d) {
        return _xAxisScale(d.x1);
    })
    .innerRadius(function (d) {
        return _yAxisScale(d.y0) == 0 ? 0 : _yAxisScale(d.y0) + _idBarHeight;
    })
    .outerRadius(function (d) {
        return _yAxisScale(d.y0) == 0 ? 0 : _yAxisScale(d.y0) + _combinedBarHeight;
    });

function arcIncircle(d, offset, print)
{
    var startAngle = _xAxisScale(d.x0);
    var endAngle = _xAxisScale(d.x1);
    var innerRadius = _yAxisScale(d.y0);
    var outerRadius = _yAxisScale(d.y1);

    var c = {x: 0, y: 0, radius: 0, diameter: 0, centerX: 0, centerY: 0}
    if(outerRadius == 0)
    {
        return c;
    }
    else if(innerRadius == 0)
    {
        c.radius = outerRadius * 0.9;
        c.diameter = c.radius * 2;
        c.centerX = c.x - c.radius;
        c.centerY = c.y- c.radius;
        return c;
    }

    innerRadius += offset;

    var r = innerRadius + ((outerRadius - innerRadius) * 0.5);
    var t = startAngle + ((endAngle - startAngle) * 0.5);

    // rough estimate of max width
    var width = r * (endAngle - startAngle);
    var height = outerRadius - innerRadius;

    c.x = r * Math.sin(t);
    c.y = -(r * Math.cos(t));
    c.radius = Math.min(width, height) * 0.5 * 0.9;
    c.diameter = c.radius * 2;
    c.centerX = c.x - c.radius;
    c.centerY = c.y- c.radius;

    return(c);
}

var _fills, _outlines, _idBars, _metaBars, _metaFill, _iconArcs;
var _imgs = [];
var _partitionData;

var _viewRoot = "";

function initLayout() {

    if (_data == null) return;

    var root = d3.hierarchy(_data);
    root.sum(function (d) {
        if(_isSizeModeActive) {
            return d.isOutermost ? d.size : 0;
        } else {
            return d.fraction;
        }
    });
    root.sort();
    _partition(root);

    _sunburst.selectAll('*').remove();

    _partitionData = root.descendants();
    _partitionData.forEach( function(d) {d.data.circle = arcIncircle(d, _combinedBarHeight)});

    if(_viewRoot == "") _viewRoot = root.data.name;
    var n = findViewRoot([root]);
    var top = findMax([n], "y0");

    if(n) _yAxisScale.domain([_yAxisScale.domain()[0], top]);

    if(_breadCrumbsData.length < 1) { updateBreadCrumbs(_partitionData[0]); }

    var clipPaths = _sunburst.selectAll("clipPath")
        .data(_partitionData)
        .enter()
        .append("clipPath")
        .attr("id", function (d) {
            return d.data.uniqueID + "_clip"
        });

    clipPaths.append("path")
        .attr("class", "mainPaths")
        .attr("id", function (d) {
            return d.data.uniqueID + "_mask"
        })
        .attr("d", arc);

    var g_outer = _sunburst.selectAll("g")
        .data(_partitionData)
        .enter()
        .append("g")
        .attr("id", function (d) { return d.data.uniqueID });

    var g = g_outer.append("g")
        .style("clip-path", function (d) {
            return "url(#" + d.data.uniqueID + "_clip)"
        })
        .on("click", function (d, i) {
            if (!d.data.image[0].length) return;
            zoom(d, i);
        });

    _fills = g.append("path")
        .attr("class", "mainPaths")
        .attr("d", function (d) {
            return d3.select("#" + d.data.uniqueID + "_mask").attr("d");
        })
        .attr("fill", function (d) {
            return "white";
        });

    _imgs.length = 3;
    _imgs[2] = g.append("image")
        .attr("overflow", "visible")
        .attr("height", function (d) {
            return d.data.image[2].length ? "1px" : "0px"
        })
        .attr("width", function (d) {
            return d.data.image[2].length ? "1px" : "0px"
        })
        .attr("transform", function (d) {
            return "matrix(" + d.data.circle.diameter + " 0 0 " + d.data.circle.diameter + " " + d.data.circle.centerX + " " + d.data.circle.centerY + ")";
        })
        .attr("xlink:href", function (d) {
            return (d.data.image[2].length != undefined) ? "data:image/png;base64," + d.data.image[2] : "";
        })
        .style("opacity", 1 );
    _imgs[1] = g.append("image")
        .attr("overflow", "visible")
        .attr("height", function (d) {
            return d.data.image[1].length ? "1px" : "0px"
        })
        .attr("width", function (d) {
            return d.data.image[1].length ? "1px" : "0px"
        })
        .attr("transform", function (d) {
            return "matrix(" + d.data.circle.diameter + " 0 0 " + d.data.circle.diameter + " " + d.data.circle.centerX + " " + d.data.circle.centerY + ")";
        })
        .attr("xlink:href", function (d) {
            return (d.data.image[1].length != undefined) ? "data:image/png;base64," + d.data.image[1] : "";
        })
        .style("opacity", function (d) {
            return Math.max(0.0, (d.data.circle.diameter - 128)/128);
        });
    _imgs[0] = g.append("image")
        .attr("overflow", "visible")
        .attr("height", function (d) {
            return d.data.image[0].length ? "1px" : "0px"
        })
        .attr("width", function (d) {
            return d.data.image[0].length ? "1px" : "0px"
        })
        .attr("transform", function (d) {
            return "matrix(" + d.data.circle.diameter + " 0 0 " + d.data.circle.diameter + " " + d.data.circle.centerX + " " + d.data.circle.centerY + ")";
        })
        .attr("xlink:href", function (d) {
            return (d.data.image[0].length != undefined) ? "data:image/png;base64," + d.data.image[0] : "";
        })
        .style("opacity", function (d) {
            return Math.max(0.0, (d.data.circle.diameter - 256)/256);
        });

    _outlines = g.append("path")
        .attr("class", "segmentOutline mainPaths")
        .attr("d", function (d) {
            return d3.select("#" + d.data.uniqueID + "_mask").attr("d");
        })
        .style("fill", "transparent");

        var g_meta = g_outer.append("g");

    _idBars = g_meta.append("path")
        .attr("class", "idOutline idPaths")
        .attr("id", function (d) {
            return d.data.uniqueID + "_idBar"
        })
        .attr("d", idArc)
        .attr("fill", function (d) {
            //return "red";
            return d3.hsv(d.data.hue, 0.5, 1.0);
        });

    var g_marker = g_meta.append("g")

    _metaFill = g_marker.append("g").selectAll("path")
            .data(function (d) {
                var data = [];
                var numTotalMarkers = d.data.expression.length;

                var length = (d.x1 - d.x0) / _numMarkers;

                var idx = 0;
                for (var i = 0; i < numTotalMarkers; i++) {

                    if (_isMarkerActive.length == 0 || _isMarkerActive[i]) {

                        var angle = idx * length + d.x0;
                        data.push({
                            "name": _markerNames.length > 0 ? _markerNames[i] : "Marker",
                            "expression": d.data.expression[i],
                            "variation": (d.data.variation) ? d.data.variation[i] : d.data.expression[i] - 2.0,
                            "x0": angle,
                            "x1": angle + length,
                            "y0": d.y0,
                            "y1": d.y1,
                            "originalIdx": i,
                            "maxIdx": d.data.maxIdx,
                            "analysis": d.data.image[0].length ? d.data.name : "",
                            "parent": d.parent != null ? d.parent.data.name : "",
                        });
                        idx++;
                    }
                }

                return data;
            })
            .enter()
            .append("path")
            .attr("class", "metaSegments")
            .attr("d", metaArc)
            .attr("fill", function (d) {
                return _color(_isVariationActive ? d.variation : d.expression);
            })
            .on("mouseover", function(d){
                _tooltip.style("display", "block")
                    .style("left", Math.max(10, d3.event.pageX-(_tooltip.node().getBoundingClientRect().width)) + "px")
                    .style("top", Math.min(height - (_tooltip.node().getBoundingClientRect().height), d3.event.pageY+10) + "px");
                _tooltip.select(".title")
                    .html(d.name);
                _tooltip.select(".exp")
                    .html(_ttNumber.to(d.expression));
                _tooltip.select(".stddev")
                    .html(_ttNumber.to(d.variation));

            })
            .on("mouseout", function(d){
                _tooltip.style("display", "none");
            });

    _metaBars = g_marker.append("path")
        .attr("class", "metaOutline metaPaths")
        .attr("id", function (d) {
            return d.data.uniqueID + "_metaBar"
        })
        .attr("d", metaArc);

    updateAdaptiveInformation();
}

function drawTooltipHeatmap(d) {

    _tooltip.selectAll('svg').remove();
    var tooltipHeatmap = _tooltip.append('svg').attr("id", "_tooltipHeatmap");

    var data = [];
    var idx = 0;
    var w = 0;
    for (var i = 0; i < d.data.expression.length; i++) {
        if (_isMarkerActive.length == 0 || _isMarkerActive[i]) {
            var name = _markerNames.length > 0 ? _markerNames[i] : ""+i;
            w = Math.max(w, name.width());
            data.push({
                "name": name,
                "expression": d.data.expression[i],
                "variation": (d.data.variation) ? d.data.variation[i] : d.data.expression[i]
            });
            idx++;
        }
    }

    var s = 15;

    tooltipHeatmap
        .attr("width", w + s + 10)
        .attr("height", s * data.length);

    var g = tooltipHeatmap.selectAll("g")
        .data(data)
        .enter()
        .append("g");

    g.append("rect")
        .attr("x", 0)
        .attr("y", function(d,i){return s*i;})
        .attr("width", s)
        .attr("height", s)
        .attr("fill", function(d){return _color(_isVariationActive ? d.variation : d.expression)});

    g.append("text")
        .attr("x", s+5)
        .attr("y", function(d,i){return s*(i+1);})
        .attr("class", "tooltipLabel")
        .text(function(d){return d.name;});
}

var _arrowWidth = 15;
var _arrowHeight = 30;
var _arrowTopOffset = 10;

function drawIcon() {

    _navIcon.selectAll('*').remove();

    _navIcon.attr("transform", "translate(" + (_navIconSize / 2 + _margin) + "," + (_navIconSize / 2 + _arrowTopOffset/2) + ")");

    _iconArcs = _navIcon.selectAll("path")
        .data(_partitionData)
        .enter()
        .append("path")
        .attr("class", "iconPaths")
        .attr("id", function (d) {
            return d.data.uniqueID + "_icon"
        })
        .attr("d", iconArc)
        // FIXME: something is going on with setting data twice and the node not finding itself in the _breadCrumbsData (even though it is still there...)
        .attr("fill", function(d,i) { if(d.parent == null || _breadCrumbsIds.indexOf(d.data.uniqueID) >= 0 ) return "rgb(60,150,250)"; else return "#F5F5F5"; })
        .on("click", function(d,i) { if(d.data.image[0].length){ zoom(d,i); } });
}

function drawBreadCrumbs() {

    _breadCrumbs.selectAll('*').remove();

    var arrows = _breadCrumbs.selectAll("path")
        .data(_breadCrumbsData)
        .enter()
        .append("path")
        .attr("class", "breadCrumbOutline")
        .attr("d", function(d,i) {
          var left = d.data.offset;
          var right = d.data.offset + d.data.width;
          var larrow = i == 0 ? left : left + _arrowWidth;
          var rarrow = right + _arrowWidth;
          var top = _arrowTopOffset;
          var middle = _arrowTopOffset + _arrowHeight/2;
          var bottom = _arrowTopOffset + _arrowHeight;
          return(
            "M " + left + " " + top + " " +
            "L " + right + " " + top + " " +
            "L " + rarrow + " " + middle + " " +
            "L " + right +  " " + bottom + " " +
            "L " + left +  " " + bottom + " " +
            "L " + larrow +  " " + middle + " " +
            "L " + left +  " " + top + " "
          )
        })
        .on("click", zoom);

    var text = _breadCrumbs.selectAll("text")
        .data(_breadCrumbsData);


    text.enter()
        .append("text")
        .text(function (d) {
            return d.data.name;
        })
        .attr("transform", function (d, i) {
            var arrowAdd = i == 0 ? 0 : _arrowWidth;
            return "translate(" + (d.data.offset + 5 + arrowAdd) + ",30)"
        })
        .on("click", zoom);

    text.exit().remove();

    drawIcon();
}

function zoomOut() {

    var d = _partitionData[0];

    _viewRoot = d.data.name;

    updateBreadCrumbs(d);

    var e = document.getElementById(d.data.uniqueID);
    e.parentNode.appendChild(e);

    var maxDepth = findMax([d], "y0");

    _xAxisScale.domain([d.x0, d.x1]);
    _yAxisScale.domain([d.y0, maxDepth]).range([0, _radius]);
}

function zoom(d, i) {

    _viewRoot = d.data.name;

    updateBreadCrumbs(d);

    var e = document.getElementById(d.data.uniqueID);
    e.parentNode.appendChild(e);

    var maxDepth = findMax([d], "y0");

    _sunburst.transition()
        .duration(1000)
        .on("end", function (){
            updateClippings();
            updateAdaptiveInformation(true);
        })
        .tween("scale", function () {
            var xd = d3.interpolate(_xAxisScale.domain(), [d.x0, d.x1]);
            var yd = d3.interpolate(_yAxisScale.domain(), [d.y0, maxDepth]);
            var yr = d3.interpolate(_yAxisScale.range(), [0, _radius]);
            return function (t) {
                _xAxisScale.domain(xd(t));
                _yAxisScale.domain(yd(t)).range(yr(t));
            };
        })
        .selectAll("path")
        .filter(function(){ return !d3.select(this).classed("metaSegments"); })
        .attrTween("d",  function (d) {
            var arcFunc = arc;
            var item = d3.select(this);
            if (item.classed("metaPaths")) {
                arcFunc = metaArc;
            }
            if (item.classed("idPaths")) {
                arcFunc = idArc;
            }
            return function () {
                d.data.circle = arcIncircle(d, _combinedBarHeight);
                //updateMetaBars();
                //updateClippings();
                updateImages(true);
                //updateAdaptiveInformation(false);
                return arcFunc(d);
            };
        });

    //_metaFill.style("opacity", 0.0);
    _metaFill.transition()
        .duration(1000)
    //    .style("opacity", 1.0)
        .attrTween("d", function (d) {
        return function () {
            return metaArc(d);
        };});
}

function updateBreadCrumbs(lastNode) {

    _breadCrumbsData.length = 0;

    var inverseBreadCrumbs = [lastNode];

    var p = lastNode.parent;
    while(p != null)
    {
        inverseBreadCrumbs.push(p);
        p = p.parent;
    }

    _breadCrumbsData = inverseBreadCrumbs.reverse();

    var offset = 20 + _navIconSize;
    for(var i = 0; i < _breadCrumbsData.length; i++ ) {
        _breadCrumbsData[i].data.offset = offset;
        var additionalSpace = i == 0 ? -5 : 10;
        var w = _breadCrumbsData[i].data.name.width() + _arrowWidth + additionalSpace;
        offset += w + 5;
        _breadCrumbsData[i].data.width = w;
    }

    //log(_breadCrumbsData)
    _breadCrumbsIds.length = _breadCrumbsData.length;
    for(var i = 0; i < _breadCrumbsData.length; i++ ) {
      _breadCrumbsIds[i] = _breadCrumbsData[i].data.uniqueID;
    }

    drawBreadCrumbs();
}

function updateClippings() {

    _fills.attr("d", function (d) {
            return d3.select("#" + d.data.uniqueID + "_mask").attr("d");
        });

    _imgs[0].attr("transform", function (d) {
            return "matrix(" + d.data.circle.diameter + " 0 0 " + d.data.circle.diameter + " " + d.data.circle.centerX + " " + d.data.circle.centerY + ")";
        });

    _imgs[1].attr("transform", function (d) {
            return "matrix(" + d.data.circle.diameter + " 0 0 " + d.data.circle.diameter + " " + d.data.circle.centerX + " " + d.data.circle.centerY + ")";
        });

    _imgs[2].attr("transform", function (d) {
            return "matrix(" + d.data.circle.diameter + " 0 0 " + d.data.circle.diameter + " " + d.data.circle.centerX + " " + d.data.circle.centerY + ")";
        });

    _outlines.attr("d", function (d) {
            return d3.select("#" + d.data.uniqueID + "_mask").attr("d");
    });
}

function updateAdaptiveInformation(recompute) {
    updateMetaBars(recompute);
    updateImages(recompute);
}

function updateMetaBars(recompute) {
    _metaBars.attr("fill", function (d) {
        d.pixelWidth = _yAxisScale(d.y0) * (_xAxisScale(d.x1) - _xAxisScale(d.x0)) / _numMarkers;
        if( d.data.expression.length == 0 ) { // no markers available => show the grey bar
            return "grey";
        } else {
            if(d.pixelWidth < 2.0) { // we dont have enough space to show complete marker expression, just show max
                return _color(_isVariationActive ? d.data.maxVariation : d.data.maxExpression);
            } else {
                return "none"
            }
        }
    })
    .on("mouseover", function(d){
        if(d.pixelWidth < 2.0) {
            drawTooltipHeatmap(d);
            if( d.data.expression.length == 0 ) { return }
            _tooltip.style("display", "block")
                .style("left", Math.max(10, d3.event.pageX-(_tooltip.node().getBoundingClientRect().width)) + "px")
                .style("top", Math.min(height - (_tooltip.node().getBoundingClientRect().height), d3.event.pageY+10) + "px");
            _tooltip.select(".title")
                .html("Max Variation: " + d.data.maxVariationName);
            _tooltip.select(".exp")
                .html(_ttNumber.to(d.data.maxExpression));
            _tooltip.select(".stddev")
                .html(_ttNumber.to(d.data.maxVariation));
        }
    })
    .on("mouseout", function(d){
        _tooltip.selectAll('svg').remove();
        _tooltip.style("display", "none");
    });
}

function updateImages(recompute) {

    _imgs[0].attr("transform", function (d) {
        if(recompute) d.data.circle = arcIncircle(d, _combinedBarHeight)
        return "matrix(" + d.data.circle.diameter + " 0 0 " + d.data.circle.diameter + " " + d.data.circle.centerX + " " + d.data.circle.centerY + ")";
    })
    .style("opacity", function (d) {
        return Math.max(0.0, (d.data.circle.diameter - 256)/256);
    });
    _imgs[1].attr("transform", function (d) {
        if(recompute) d.data.circle = arcIncircle(d, _combinedBarHeight)
        return "matrix(" + d.data.circle.diameter + " 0 0 " + d.data.circle.diameter + " " + d.data.circle.centerX + " " + d.data.circle.centerY + ")";
    })
    .style("opacity", function (d) {
        return Math.max(0.0, (d.data.circle.diameter - 128)/128);
    });
    _imgs[2].attr("transform", function (d) {
        if(recompute) d.data.circle = arcIncircle(d, _combinedBarHeight)
        return "matrix(" + d.data.circle.diameter + " 0 0 " + d.data.circle.diameter + " " + d.data.circle.centerX + " " + d.data.circle.centerY + ")";
    })
    .style("opacity", 1);
}

var _maxVal = 5;

function setData(d) {

    initData(d);

    setColormap(_activeColormap);

    initLayout();
    drawIcon();
}

function setMarkerSelection(isMarkerActive) {

    _isMarkerActive = isMarkerActive.slice();

    _numMarkers = _isMarkerActive.reduce(function (a, b) { return a + b }, 0);

    if (_data) initLayout();
}

function setMarkerNames(names) {

    _markerNames = JSON.parse(names).names;

    if (_data) initLayout();
}

function addAvailableData(name) {

    for (var i = 0; i < _availableDataSets.length; i++) {
        if (name == _availableDataSets[i]) {
            return;
        }
    }
    _availableDataSets.push(name);
    updateAvailableDataSelectionBox();
}

function initData(d) {

    _data = JSON.parse(d);

    _uniqueId = 0;
    addUniqueIds([_data]);

    addFraction([_data], 1.0);

    updateMaxStatistics([_data]);
    rebuildRangeSlider();

    _maxVal = findMax([_data], "size");

    if(_isMarkerActive.length > 0) {
        _numMarkers = _isMarkerActive.reduce(function (a, b) { return a + b }, 0);
    } else {
        _numMarkers = findNumMarkers([_data]);
    }
}

function addUniqueIds(d) {
    for (var i in d) {
        if (d[i] !== null && typeof (d[i]) == "object") {
            //log(o[i].size)
            d[i].uniqueID = "UID" + _uniqueId++;
            //going one step down in the object tree
            addUniqueIds(d[i].children);
        }
    }
}

function addFraction(d, v) {
    for (var i in d) {
        //log(o[i].size)
        //going one step down in the object tree
        if (d[i].children !== null && typeof (d[i].children) == "object") {
            d[i].isOutermost = false;
            addFraction(d[i].children, v / d[i].children.length);
        } else {
            d[i].isOutermost = true;
            d[i].fraction = v;
        }
    }
}

function updateMaxStatistics(d) {

    _expressionRange = [9999.9, 0.0];
    _variationRange = [9999.9, 0.0];

    updateMaxStatisticsRecursive(d)
}

function updateMaxStatisticsRecursive(d) {

    for (var i in d) {
        if (d[i] !== null && typeof (d[i]) == "object") {

            d[i].maxExpression = 0.0;
            d[i].maxVariation = 0.0;
            d[i].maxVariationName = "";
            d[i].maxIdx = -1;

            var minExpression = 9999.9;
            var maxExpression = 0.0;
            var minVariation = 9999.9;
            var maxVariation = 0.0;

            if (d[i].expression && d[i].expression.length > 0) {

                var variation = (d[i].variation && d[i].variation.length > 0) ? d[i].variation : d[i].expression;

                for( var j = 0; j < _isMarkerActive.length; j++ )
                {
                    if(!_isMarkerActive[j]) continue;

                    if(variation[j] >= maxVariation)
                    {
                        maxVariation = variation[j];
                        d[i].maxIdx = j;
                    }

                    minExpression = Math.min(minExpression, d[i].expression[j]);
                    maxExpression = Math.max(maxExpression, d[i].expression[j]);
                    minVariation = Math.min(minVariation, variation[j]);
                }
                d[i].maxExpression = d[i].expression[d[i].maxIdx];
                d[i].maxVariation = maxVariation;
                d[i].maxVariationName = _markerNames.length > 0 ? _markerNames[d[i].maxIdx] : d[i].maxIdx;
            }

            _expressionRange[0] = Math.min(_expressionRange[0], minExpression);
            _expressionRange[1] = Math.max(_expressionRange[1], maxExpression);
            _variationRange[0] = Math.min(_variationRange[0], minVariation);
            _variationRange[1] = Math.max(_variationRange[1], maxVariation);

            //going one step down in the object tree
            updateMaxStatisticsRecursive(d[i].children);
        }
        //log(d[i].maxIdx);
    }
}

function findMax(d, attr) {
    var m = 0;
    for (var i in d) {
        if (d[i] !== null && typeof (d[i]) == "object") {
            if (d[i][attr] != undefined) {
              m = Math.max(m, d[i][attr]);
            }
            m = Math.max(m, findMax(d[i].children, attr));
        }
    }
    return m;
}

function findViewRoot(d) {

    var node = null;

    for (var i in d) {
        if (d[i] !== null && typeof (d[i]) == "object") {
            if(d[i].data.name == _viewRoot) {
                return d[i];
            }
            n = findViewRoot(d[i].children);
            if(n) return n;
        }
    }
    return null;
}

function findNumMarkers(d) {
    var m = 0;
    for (var i in d) {
        if (d[i] !== null && typeof (d[i]) == "object") {
            //log(d[i])
            if (d[i].expression != undefined && d[i].expression.length > 0)
            {
              return d[i].expression.length;
            }

            //going on step down in the object tree
            m = findNumMarkers(d[i].children);

            if(m > 0)
            {
              return m;
            }
        }
    }
    return m;
}

// =============================================================================
// interaction
// =============================================================================
function leftClickColormap(idx) {

    setColormap(idx, true);

    initLayout();
}

function toggleDiscreteColormap() {

    _isColormapDiscrete = !_isColormapDiscrete;

    setColormap(_activeColormap, false);

    initLayout();
}

function toggleVariation() {
    _isVariationActive = !_isVariationActive;

    setColormap(_isVariationActive ? 12 : 6, true);

    initLayout();

    rebuildRangeSlider();
}

function toggleSizeMode() {
    _isSizeModeActive = !_isSizeModeActive;

    zoomOut();

    initLayout();
    drawIcon();
}

function updateAvailableDataSelectionBox() {

    var selector = document.getElementById("explorationSelector");
    var selected;
    if (selector.length > 0) {
        selected = selector.selectedIndex;
    }
    selector.length = 1;

    for (var i = 0; i < _availableDataSets.length; i++) {

        var opt = document.createElement("option");
        opt.text = _availableDataSets[i];
        opt.value = _availableDataSets[i];

        selector.add(opt);
    }

    selector.selectedIndex = selected;
}

// =============================================================================
// Windowing ===================================================================
// =============================================================================
function resize() {

    width = window.innerWidth;
    height = window.innerHeight;

    _sunburstHeight = height - _breadCrumbsHeight;
    _radius = Math.min(width, _sunburstHeight) / 2 - _combinedBarHeight - _margin;

    _containerSvg.attr("width", width)
        .attr("height", height);

    _sunburst.attr("transform", "translate(" + width / 2 + "," + (height / 2 + 2 * _margin) + ")");

    _yAxisScale.range([0, _radius]);

    initLayout();
}

// =============================================================================
// external
// =============================================================================
function setActiveExploration(name) {

    if (isQtAvailable) {
        Qt.js_selectData(name);
    } else {
        zoomOut();
        setData(window[name]);
    }
}

function raise(name, markerIndex) {

    if (isQtAvailable) {
        Qt.js_raiseView(name, parseInt(markerIndex));
    }
}

// =============================================================================
// run =========================================================================
// =============================================================================

resize();
d3.select(window).on("resize", resize);
initLegend();

if (!isQtAvailable) {
    _markerNames = ["","","","","","","","","Ter119", "CD45.2", "Ly6G", "IgD", "CD11c", "F480", "CD3", "NKp46", "CD23", "CD34", "CD115", "CD19", "120g8", "CD8", "Ly6C", "CD4", "CD11b", "CD27", "CD16_32", "SinglecF", "Foxp3", "B220", "CD5", "FceR1a", "TCRgd", "CCR7", "Sca1", "CD49b", "cKit", "CD150", "CD25", "TCRb", "CD43", "CD64", "CD138", "CD103", "IgM", "CD44", "MHCII","","","",""];
    var active = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0];
    setMarkerSelection(active);
    setData(_p1);
}
