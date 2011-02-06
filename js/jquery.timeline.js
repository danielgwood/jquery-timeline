/**
 * --------------------------------------------------------------------
 * jQuery Plugin "timeline"
 * by Daniel G Wood, daniel.g.wood@gmail.com

 * Copyright (c) 2011
 * Version: 0.3, 06.02.2010
 *
 * TODO:
 *  High priority
 *  - Move JS plugin out to file
 *  - Y distribution function error
 *
 *  Mid priority
 *  - Full demo
 *  - Prevent scrolling to future via option
 *  - Negative years..
 *  - Rescale should find middle year in current display, zoom in and show this
 *  - Intro/Usage page
 *  - Review options/defaults - are all used, rename, reorder
 *  - Themeing - fonts, sizes, colours
 *  - JavaDocing
 *  - Setup project site
 *  - Restrict to range options
 *  - Review default theme/style
 *  - Bottom dates from data input
 *  - Extend temporalAlign to allow 'beginning|middle|most-populous|end'
 *  - "Your browser doesn't support canvas" message
 *  - Refactor events, periods to objects?
 *  
 *  Low priority / eventual
 *  - Add 'targetDate' to scroll options
 *  - Zoom level indicator/control
 *  - Overall mini-viewer
 *  - FAQs: why not SVG? what alternatives? appearance? why doesn't it do X?
 *  - Credit: hockey man, simile, http://net.tutsplus.com/tutorials/javascript-ajax/fun-with-canvas-create-a-jquery-graph-plugin/, http://diveintohtml5.org/canvas.html, http://billmill.org/static/canvastutorial/coda.html
 * --------------------------------------------------------------------
**/

(function($){

    /* Public methods */
    var methods = {
        init : function( options )
        {
            // Merge parameters with defaults
            var opts = $.extend({}, $(this).timeline('defaults'), options);

            // Cycle through each object
            return this.each(function() {

                // Initialise vars in data
                var $this = $(this),
                    data = $this.data('timeline');

                if(!data) {
                    $this.data('timeline',
                    {
                        opts: opts,
                        cv: null,
                        cvContext: null,
                        events: [],
                        perYear: [],
                        periods: [],
                        dataYStart: 0,
                        intervalIncrement: null,
                        majorLineInterval: null,
                        scale: null,
                        startDate: null,
                        minDate: null,
                        maxDate: null,
                        container: $this.attr("id"),
                        dataSource: $this.children('table').attr("id"),
                        coordMap: []
                    });
                }

                // Initialise
                canvasSupported = initCanvas($this);
                if(canvasSupported) {
                    getTemporalData($this.data('timeline'), $this);
                    $this.timeline('draw');
                    attachListeners($this.data('timeline'), $this);

                    if($this.data('timeline').opts.hideDataSource) {
                        $('#' + $this.data('timeline').dataSource).hide();
                    }
                }
            });
        },
        draw : function()
        {
            var data = $(this).data('timeline');

            // Fit to width
            if(data.opts.fitWidth) {
                data.cv.width = $(window).width();
                data.opts.cvWidth = $(window).width();
            }

            // Clear
            data.cvContext.clearRect(0, 0, data.cv.width, data.cv.height);
            data.dataYStart = 0;
            data.coordMap = [];

            // Set scaling
            if(data.scale == null) {
                data.scale = data.opts.initialScale;
            }

            // Use scaling
            data.intervalIncrement = function(val) { return val+1; };
            switch(data.scale) {
                case 'decades':
                    data.majorLineInterval = 10;
                    data.intervalIncrement = function(val) { return val+10; };
                    break;
                case 'centuries':
                    data.intervalIncrement = function(val) { return val+100; };
                    data.majorLineInterval = 20;
                    break;
                case 'millennia':
                    data.intervalIncrement = function(val) { return val+1000; };
                    data.majorLineInterval = 50;
                    break;
                default:
                    data.majorLineInterval = 12;
            }

            // Invoke drawing methods
            drawTitle(data);
            drawPeriods(data);
            drawIntervalLines(data);
            drawDates(data);
            drawEvents(data);
        },
        scroll : function( direction, continuous )
        {
            var $this = $(this);
            $this.timeline('stopScroll');
            var startDate = $this.data('timeline').startDate;
            var incrementFunc = $this.data('timeline').intervalIncrement;

            if(continuous === true) {
                // Continuous scrolling until stopScroll called
                $this.data('timeline').animation = setInterval(function() {
                    if(direction == 'past') {
                        startDate = startDate - (incrementFunc(startDate) - startDate);

                    } else {
                        startDate = incrementFunc(startDate);
                    }

                    //steps++;
                    $this.data('timeline').startDate = startDate;
                    $this.timeline('draw');
                }, 100);


            } else {
                // Scroll once
                if(direction == 'past') {
                    startDate = startDate - (incrementFunc(startDate) - startDate);
                } else {
                    startDate = incrementFunc(startDate);
                }

                $(this).data('timeline').startDate = startDate;
                $(this).timeline('draw');
            }
        },
        stopScroll : function()
        {
            clearInterval($(this).data('timeline').animation);
            $(this).data('timeline').steps = 0;
        },
        scale : function( name )
        {
            var data = $(this).data('timeline');

            if(data.opts.scaling === true) {
                // Get supported scales
                var scales = $(this).timeline('defaults').supportedScales;

                if(name == 1) {
                    // Zoom in
                    var pos = scales.indexOf(data.scale);
                    if(pos > 0) {
                        data.scale = scales[pos-1];
                    }

                } else if(name == -1) {
                    // Zoom out
                    var pos = scales.indexOf(data.scale);
                    if(pos < scales.length-1) {
                        data.scale = scales[pos+1];
                    }

                } else if(jQuery.inArray(name, scales)) {
                    // Zoom to
                    data.scale = name;
                }

                $(this).timeline('draw');
            }
        },
        click: function( event )
        {
          var data = $(this).data('timeline');

          var elemPos = $(this).offset();

          var yPos = event.pageY - elemPos.top;
          var xPos = event.pageX - elemPos.left;

          for(var i = 0; i < data.coordMap.length; i++) {
              var item = data.coordMap[i];

              if(xPos >= item[0] && xPos < item[2]) {
                  if(yPos >= item[1] && yPos < item[3]) {
                      alert(item[4]);
                  }
              }
          }
        },
        defaults : function()
        {
            return {
                fitWidth: true,
                cvWidth: 800,
                cvHeight: 240,
                periodHeight: 18,
                periodGutter: 4,
                timeHeight: 30,
                intervalWidth: 8,
                labelWidthChars: 19,
                labelXOffset: 6.5,
                showMinorIntervals: true,
                showMajorIntervals: true,
                showEventText: true,
                showEventDates: true,
                hideDataSource: true,
                initialScale: 'years',
                supportedScales: ['years', 'decades', 'centuries', 'millennia'],

                keyBindings: true,
                leftScrollElem: null,
                rightScrollElem: null,
                temporalAlign: 'middle',
                scrolling: true,
                scaling: true
            };
        }
    };

    /* Plugin initialise */
    $.fn.timeline = function( method ) {
        if ( methods[method] ) {
            return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));

        } else if ( typeof method === 'object' || ! method ) {
            return methods.init.apply( this, arguments );

        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.timeline' );
        }
    };

    /* Private methods */

    /**
     *
     */
    function initCanvas( elem )
    {
        var data = elem.data('timeline');

        $('#' + data.container).prepend('<canvas id="timeline-prototype"></canvas>');

        // Set size
        data.cv = $('#timeline-prototype').get(0);
        if(data.opts.fitWidth) {
            data.cv.width = $(window).width();
            data.opts.cvWidth = $(window).width();
        } else {
            data.cv.width = data.opts.cvWidth;
        }
        data.cv.height = data.opts.cvHeight;

        // Check canvas is supported by the browser
        if (!data.cv.getContext) {
            return false;
        }

        data.cvContext = data.cv.getContext('2d');
        if (!data.cvContext) {
            return false;
        }

        return true;
    }

    /**
     *
     */
    function getTemporalData( data, elem )
    {
        var periods = [];
        var events = [];

        // Get data from the page
        $("#" + data.dataSource + " tr").each(function(){
            if($(this).children('td').length > 1) {
                var eventDate = $(this).children('td:nth-child(1)').text();
                var eventDesc = $(this).children('td:nth-child(2)').text();

                if(eventDate.indexOf('-') > 0) {
                    // Period
                    var dates = eventDate.split('-');
                    dates[0] = new Date(dates[0]);
                    dates[1] = new Date(dates[1]);

                    if(dates[0] != 'Invalid Date' && dates[1] != 'Invalid Date') {
                       periods.push([
                            eventDesc + ' (' + dates[0].getFullYear() + ' - ' + dates[1].getFullYear() + ')',
                            dates[0].getFullYear(),
                            dates[1].getFullYear() - dates[0].getFullYear()
                        ]);

                    } else {
                        //alert('Invalid period: ' . eventDate);
                    }

                } else {
                    var eventDate = new Date(eventDate);

                    // Event
                    if(eventDate == 'Invalid Date') {
                        //alert('Invalid date: ' + $(this).children('td:nth-child(1)').text());

                    } else {
                        events.push([
                            eventDesc,
                            eventDate.getFullYear(),
                            eventDate.getFullYear(),
                            eventDate.getMonth()+1
                        ]);
                    }
                }
            }
        });

        // TODO set this automatically, according to option.temporalAlign, option.cvWidth, and the input data
        elem.data('timeline').startDate = 0;

        data.periods = periods;
        data.events = events;
    }


    /**
     *
     */
    function attachListeners( data, elem )
    {
        if(data.opts.leftScrollElem !== null && data.opts.rightScrollElem !== null) {
           // Left and right sensors provided
            $('#' + data.opts.leftScrollElem).hover(
                function() {
                    elem.timeline('scroll', 'past', true);
                },
                function() {
                    elem.timeline('stopScroll')
                }
           );
           $('#' + data.opts.rightScrollElem).hover(
                function() {
                    elem.timeline('scroll','future', true);
                },
                function() {
                    elem.timeline('stopScroll')
                }
           );
        }

        if(data.opts.keyBindings) {
            // Keyboard bindings enabled
            $(document).keydown(function(event) {
                if(event.keyCode == 37) {
                    // Left arrow
                    elem.timeline('scroll', 'past', false);

                } else if(event.keyCode == 39) {
                    // Right arrow
                    elem.timeline('scroll', 'future', false);

                } else if(event.keyCode == 107 || event.keyCode == 187) {
                    // Plus key
                    elem.timeline('scale', 1);

                } else if(event.keyCode == 109 || event.keyCode == 189) {
                    // Minus key
                    elem.timeline('scale', -1);

                }
            });
        }

        // Click handler
        var canvasId = data.cv.id;
        $('#' + canvasId).click(function(event) {
            elem.timeline('click', event);
        });

        // Fit to window handler
        $(window).resize(function(){
            elem.timeline('draw');
        })
    }

    /**
     *
     */
    function drawTitle( data )
    {
       if(data.opts.title !== undefined) {
            // Text appearance
            data.cvContext.fillStyle = '#333333';
            data.cvContext.font = '20px Georgia, serif';
            data.cvContext.textBaseline = 'top';
            data.cvContext.textAlign = 'center';

            // Draw text
            data.cvContext.fillText(data.opts.title, (data.opts.cvWidth / 2), 12);

            // Push down data
            data.dataYStart += 50;
       }
    }

    /**
     *
     */
    function drawPeriods( data )
    {
        if(data.periods.length == 0) {
            return;
        }

        // Draw each period
        var yPos = data.dataYStart + data.opts.periodGutter;
        var drawnRanges = [];
        for(var i = 0; i < data.periods.length; i++) {
            // Convert years to xPos
            var xEnd = getPositionFromDate(data.startDate, data.opts.intervalWidth, data.scale, data.periods[i][1] + data.periods[i][2], 0);
            var xStart = getPositionFromDate(data.startDate, data.opts.intervalWidth, data.scale, data.periods[i][1], 0);

            var newRange = [xStart, xEnd];

            // Put overlapping periods on new lines
            var j = 0;
            var foundSpace = false;
            while(foundSpace == false) {

                if(drawnRanges[j] === undefined) {
                    // First period at this Y, create a set of used
                    // X ranges at this Y
                    drawnRanges[j] = [];
                    foundSpace = true;

                } else {
                    // Have drawn some periods at this Y, check if
                    // this new one will fit
                    foundSpace = true;
                    drawnRanges[j].filter(function(val) {
                        if(newRange[0] > val[0] && newRange[0] < val[1]) {

                            // Intersection found
                            foundSpace = false;
                        }
                        if(newRange[1] < val[1] && newRange[1] > val[0]) {

                            // Intersection found
                            foundSpace = false;
                        }

                    });
                }

                // Move to next Y
                if(foundSpace == false) {
                    yPos += data.opts.periodHeight + data.opts.periodGutter;
                    j++;
                }
            }

            // Add to drawnRanges
            drawnRanges[j].push(newRange);

            // Draw
            var xWidth = xEnd - xStart;
            drawPeriod(data.cvContext, data.periods[i][0], xStart, yPos, data.opts.periodHeight, xWidth);
        }

        data.dataYStart = (yPos + data.opts.periodHeight + data.opts.periodGutter);
    }

    /**
     *
     */
    function drawPeriod(cvContext, periodTitle, xPos, yPos, periodHeight, periodWidth, bgColour, textColour, lineColour)
    {
        // Box appearance
        fillColour = '#f5f5f5';
        strokeColour = '#cccccc';
        detailColour = '#333333';

        if(bgColour !== undefined) {
            fillColour = bgColour;
        }
        if(textColour !== undefined) {
            detailColour = textColour;
        }
        if(lineColour !== undefined) {
            strokeColour = lineColour;
        }
        cvContext.fillStyle = fillColour;
        cvContext.strokeStyle = strokeColour;

        // Draw box
        cvContext.fillRect(xPos, yPos + 0.5, periodWidth, periodHeight);
        cvContext.strokeRect(xPos, yPos + 0.5, periodWidth, periodHeight);

        // Text appearance
        cvContext.fillStyle = detailColour;
        cvContext.font = 'bold 11px sans-serif';
        cvContext.textBaseline = 'middle';
        cvContext.textAlign = 'center';

        // Restrict text to box size. TODO this is a little primitive
        var charWidth = cvContext.measureText('X').width;
        var maxChars = Math.floor(periodWidth / charWidth);
        if(maxChars < 2) {
            periodTitle = '';
          
        } else if(periodTitle.length > maxChars) {
            periodTitle = periodTitle.substr(0, maxChars-1);
            periodTitle += '…';
        }

        // Draw text
        cvContext.fillText(periodTitle, xPos + (periodWidth / 2), yPos + 0.5 + (periodHeight / 2));
    }

    /**
     *
     */
    function drawDates( data )
    {
        data.cvContext.fillStyle = '#888';
        data.cvContext.font = 'bold 18px sans-serif';
        data.cvContext.textBaseline = 'bottom';
        data.cvContext.textAlign = 'left';

        var xPos = 4.5;  // Margin from the interval line
        var yPos = data.opts.cvHeight;

        var unit = data.startDate;
        while(xPos < data.opts.cvWidth) {
            data.cvContext.fillText(unit, xPos, yPos);

            xPos = xPos + (data.opts.intervalWidth * data.majorLineInterval);
            unit = data.intervalIncrement(unit);
        }
    }

    /**
     *
     */
    function drawIntervalLines( data )
    {
        var opts = data.opts;
        var cvContext = data.cvContext;
        var height = (data.opts.cvHeight - data.dataYStart) - opts.timeHeight;

        if(opts.showMinorIntervals) {
            // Minor lines
            cvContext.beginPath();
            cvContext.lineWidth = 1;
            for(var xPos = 0.5; xPos < opts.cvWidth; xPos += opts.intervalWidth) {
                cvContext.moveTo(xPos, data.dataYStart);
                cvContext.lineTo(xPos, height + data.dataYStart);
            }
            cvContext.strokeStyle = "#eee";
            cvContext.stroke();
        }

        if(opts.showMajorIntervals) {
            // Major lines
            cvContext.beginPath();
            for(var xPos = 0.5; xPos < opts.cvWidth; xPos += (opts.intervalWidth * data.majorLineInterval)) {
                cvContext.moveTo(xPos, data.dataYStart);
                cvContext.lineTo(xPos, height + opts.timeHeight + data.dataYStart);
            }
            cvContext.strokeStyle = "#ccc";
            cvContext.stroke();
        }
    }

    /**
     *
     */
    function drawEvents( data )
    {
        // Minimum and maximum y for events
        var minY = data.dataYStart + 10;
        var maxY = data.opts.cvHeight - 10;
        
        // Number of times to try finding a space on Y axis before giving up
        var maxYAttempts = Math.floor((maxY - minY) / 100);

        for(var i = 0; i < data.events.length; i++) {
            // Calculate X for event
            var xPos = getPositionFromDate(data.startDate, data.opts.intervalWidth, data.scale, data.events[i][2], data.events[i][3]);
            if(xPos === false) {
                continue;
            }

            // Start at the top - ensures maximum H is used
            var yPos = minY;

            // Using the coordMap, try to avoid overlapping events
            var attemptsLeft = maxYAttempts;
            var foundPos = false;
            if(data.coordMap.constructor == Array && data.coordMap.length > 0) {
                while(!foundPos && attemptsLeft > 0) {
                    foundPos = true;

                    for(var j = 0; j < data.coordMap.length; j++) {
                        var currentSet = data.coordMap[j];

                        if((xPos >= currentSet[0] && xPos <= currentSet[2]) && (yPos >= currentSet[1] && yPos <= currentSet[3])) {
                            foundPos = false;
                            yPos = currentSet[3] + 30;
                        }
                    }

                    attemptsLeft--;
                }
                
            } else {
                // Its empty, of course there is space!
                foundPos = true;
            }

            // Draw event
            if(foundPos) {
                drawEvent(
                    data,
                    data.events[i][0],
                    data.events[i][1],
                    xPos,
                    yPos
                );
            }
        }
    }

    /**
     *
     */
    function drawEvent(data, eventTitle, eventDate, xPos, yPos)
    {
        var lines = 0;
        var opts = data.opts;
        var cvContext = data.cvContext;
        var coords = [];

        eventTitle.trim();

        // Date on first line, text on lines after that
        if(eventTitle !== null && opts.showEventText) {
            lines++;
        }
        if(eventDate !== null && opts.showEventDates) {
            lines++;
        }

        // Split long text on multiple lines. TODO make more efficient
        var wrappedText = [];
        if(eventTitle.length > 15 && opts.showEventText) {

            var currentChar = 0;
            var currentLine = 0;
            var lineBreak = false;
            var thisLine = [];

            for(var i = 0; i < eventTitle.length; i++) {
                // Line break needed if char % lineWidthChars == 0
                if(i % opts.labelWidthChars == 0) {
                    lineBreak = true;
                }

                // If not needing a linebreak, or needing one and we're not
                // currently on a space'character, add letter to current line
                if(!lineBreak || (lineBreak && eventTitle[i] != ' ')) {
                    thisLine[currentChar] = eventTitle[i];

                // Needing a linebreak, and we're on a space character'
                } else {
                    wrappedText[currentLine] = thisLine.join('');;
                    currentLine++;
                    currentChar = 0;
                    thisLine = [];
                    lineBreak = false;
                }

                currentChar++;
            }

            wrappedText[currentLine] = thisLine.join('');

        // Really short event text, just add it
        } else {
            wrappedText[0] = eventTitle;
        }

        // Fill and stroke styles
        cvContext.fillStyle = '#888';
        cvContext.font = 'bold 10px sans-serif';
        cvContext.textAlign = 'left';
        cvContext.textBaseline = 'bottom';
        var lineHeight = 11;

        // Draw event marker
        cvContext.beginPath();
        cvContext.arc(xPos, yPos, 3, 0, Math.PI*2, true);
        cvContext.closePath();
        cvContext.fill();
        coords[0] = xPos - 3;

        // Draw event date
        coords[1] = yPos - 10;
        if(eventDate !== null && opts.showEventDates) {
            cvContext.fillText(eventDate, xPos + opts.labelXOffset, yPos);
            yPos += lineHeight;
        }

        // Draw event text
        var maxX = 0;
        if(opts.showEventText) {
            for(var j = 0; j < wrappedText.length; j++) {
                // Draw text
                cvContext.fillText(wrappedText[j], xPos + opts.labelXOffset, yPos);

                // Work out maxX for mouse interaction
                var lineWidth = cvContext.measureText(wrappedText[j]).width;
                maxX = (maxX > (xPos + opts.labelXOffset + lineWidth)) ? maxX : xPos + opts.labelXOffset + lineWidth;

                // Advance pointer down Y axis
                yPos += lineHeight;
            }
        }
        coords[2] = maxX;
        coords[3] = yPos - lineHeight;

        coords[4] = wrappedText[0];

        // Add to coordinate map
        data.coordMap.push(coords);
    }

    /**
     *
     */
    function getPositionFromDate(startDate, intervalWidth, scale, year, month)
    {
        // Check the date fits on this timeline
        if(year < startDate) {
            return false;
        }

        // Decades
        var xPos = 0.5;
        var years = (year - startDate);
        xPos += years * intervalWidth;

        // Other scales
        if(scale == 'years') {
            xPos = (years * 12) * intervalWidth;
            xPos += month * intervalWidth;

        } else if(scale == 'centuries') {
            xPos = (years / 5) * intervalWidth;

        } else if(scale == 'millennia') {
            xPos = (years / 10) * intervalWidth;
        }

        return xPos;
    }
    
    /**
     * Copyright (c) Mozilla Foundation http://www.mozilla.org/
     * This code is available under the terms of the MIT License
     */
    if (!Array.prototype.filter) {
        Array.prototype.filter = function(fun /*, thisp*/) {
            var len = this.length >>> 0;
            if (typeof fun != "function") {
                throw new TypeError();
            }
    
            var res = [];
            var thisp = arguments[1];
            for (var i = 0; i < len; i++) {
                if (i in this) {
                    var val = this[i]; // in case fun mutates this
                    if (fun.call(thisp, val, i, this)) {
                        res.push(val);
                    }
                }
            }
    
            return res;
        };
    }

})(jQuery);
