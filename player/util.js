
// Clamp a number to range [min, max]
function clamp(number, min, max) {
    return Math.min(Math.max(number, min), max);
}

function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function dateToMMSS(time) {
    if (isNaN(time)) {
        return
    }

    var min = Math.round( (time / 60) << 0);
    var sec = Math.round( (time) % 60);
    return (min.toString().length >= 2 ? min : '0' + min)
        + ':' + (sec.toString().length >= 2 ? sec : '0' + sec);
}

function getBatchColor(batch) {
    if (!batch.annotations) {
        batch.annotations = [];
    }

    var ann = batch.annotations[0];

    if (typeof ann !== 'undefined' && ann.author && (typeof ann.author.name !== 'undefined'
        || typeof ann.author.username !== 'undefined')) {
        var name = typeof ann.author.name !== 'undefined' ? ann.author.name : ann.author.username;
        var hash = fnv1aHashString(name);
        var color = getAnnotationColorForHash(hash);

        return color;

    }
}


function getParameterByName(name, url) {
    if (!url) {
      url = window.location.href;
    }
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// Escape string so that it can be set to innerHTML of a node.
function stringToHTMLSafe(str) {
    var escapes = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        '\'': '&apos;',
        '\n': '<br>',
    };

    return str.replace(/[<>&"'\n]/g, function(match) {
        return escapes[match];
    });
}

// Turn decimal [0.0, 1.0] to CSS percent value [0%, 100%]
function cssPercent(value) {
    return (value * 100) + "%";
}

// Visualize data with DOM elements
// Data items are converted to DOM elements created by `newElement` and
// mutated by `toElement`.
function DomView(opts)
{
    this.elements = [];
    this.container = opts.container;
    this.newElement = opts.newElement;
    this.toElement = opts.toElement;
    return this;
}

// Provide array of data to visualize.
DomView.prototype.update = function(data)
{
    var i = 0;

    while (this.elements.length < data.length) {
        var element = this.newElement(data[i]);
        element.style.visibility = "hidden";
        this.container.appendChild(element);
        this.elements.push(element);
        i = i + 1;
    }

    for (var i = data.length; i < this.elements.length; i++) {
        this.elements[i].style.visibility = "hidden";
    }

    for (var i = 0; i < data.length; i++) {
        this.toElement(this.elements[i], data[i]);
        this.elements[i].style.visibility = "visible";
    }
};

function elemWithClasses(type) {
    var div = document.createElement(type);
    for (var i = 1; i < arguments.length; i++) {
        div.classList.add(arguments[i]);
    }
    return div;
}

function getTimeSeconds() {
    return new Date().getTime() / 1000.0;
}

/**
 * Retrieve the coordinates of the given event relative to the center
 * of the widget.
 *
 * @param event
 *   A mouse-related DOM event.
 * @param reference
 *   A DOM element whose position we want to transform the mouse coordinates to.
 * @return
 *    A hash containing keys 'x' and 'y'.
 */
function getRelativeCoordinates(event, reference) {
    var x, y;
    event = event || window.event;
    var el = event.target || event.srcElement;
    if (!window.opera) {
        // Use offset coordinates and find common offsetParent
        var pos = {};
        if (event.type === 'touchend' || event.type === 'touchstart' || event.type === 'touchmove') {
            var touch = event.changedTouches[0];
            if (typeof touch !== 'undefined') {
                var rect = el.getBoundingClientRect();
                var offset = {
                    top: rect.top + document.body.scrollTop,
                    left: rect.left + document.body.scrollLeft,
                };

                pos.x = touch.pageX - offset.left;
                pos.y = touch.pageY - offset.top;
                return pos;
            }
        }

        pos.x = event.offsetX;
        pos.y = event.offsetY;

        // Send the coordinates upwards throu)gh the offsetParent chain.
        var e = el;
        while (e) {
            e.mouseX = pos.x;
            e.mouseY = pos.y;
            pos.x += e.offsetLeft;
            pos.y += e.offsetTop;
            e = e.offsetParent;
        }
        // Look for the coordinates starting from the reference element.
        var e = reference;
        var offset = { x: 0, y: 0 }
        while (e) {
            if (typeof e.mouseX != 'undefined') {
                x = e.mouseX - offset.x;
                y = e.mouseY - offset.y;
                break;
            }
            offset.x += e.offsetLeft;
            offset.y += e.offsetTop;
            e = e.offsetParent;
        }

        // Reset stored coordinates
        e = el;
        while (e) {
            e.mouseX = undefined;
            e.mouseY = undefined;
            e = e.offsetParent;
        }
    }
    else {
        // Use absolute coordinates
        var pos = getAbsolutePosition(reference);
        x = event.pageX  - pos.x;
        y = event.pageY - pos.y;
    }
    // Subtract distance to middle
    return { x: x, y: y };
}

var MouseState = {
    Up: 1,
    Move: 2,
    Down: 3,
};

function relativeClickHandler(element, callback) {
    var data = { down: false };

    var mouseCallback = function(state) {
        return function(e) {
            e.preventDefault();
            if (state == MouseState.Down) {
                if (data.down)
                    return false;
                data.down = true;
            } else if (state == MouseState.Up) {
                if (!data.down)
                    return false;
                data.down = false;
            } else if (state == MouseState.Move) {
                if (!data.down)
                    return;
            }

            var width = element.clientWidth || element.offsetWidth || 10000;
            var height = element.clientHeight || element.offsetHeight || 10000;

            var relative = getRelativeCoordinates(e, element);
            relative.x /= width;
            relative.y /= height;

            if (relative.x < 0) relative.x = 0;
            if (relative.y < 0) relative.y = 0;
            if (relative.x >= 1) relative.x = 1;
            if (relative.y >= 1) relative.y = 1;
            callback(state, relative);
        }
    };

    element.addEventListener('mousedown', mouseCallback(MouseState.Down));
    element.addEventListener('touchstart', mouseCallback(MouseState.Down));

    element.addEventListener('mousemove', mouseCallback(MouseState.Move));
    element.addEventListener('touchmove', mouseCallback(MouseState.Move));

    element.addEventListener('mouseup', mouseCallback(MouseState.Up));
    element.addEventListener('touchend', mouseCallback(MouseState.Up));

    element.addEventListener('mouseout', mouseCallback(MouseState.Up));
}

function epsilonFix(target, value, epsilon) {
    if (Math.abs(target - value) < epsilon) {
        return target;
    } else {
        return value;
    }
}

function registerFullscreenCallback(callback) {
    document.addEventListener('fullscreenchange', callback);
    document.addEventListener('mozfullscreenchange', callback);
    document.addEventListener('webkitfullscreenchange', callback);
    document.addEventListener('MSfullscreenchange', callback);
}

function requestFullscreenElement(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    }
}

function removeFullscreenElement() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    }
}

function getFullscreenElement() {
    return (
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        null);
}

function isFullscreenElement(elem) {
    return elem == getFullscreenElement();
}

function propCompare(a, b) {
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
}

function annotationCompare(a, b) {
    return propCompare(a.time, b.time)
        || propCompare(a.position.x, b.position.x)
        || propCompare(a.position.y, b.position.y)
        || propCompare(a.text, b.text)
        || propCompare(a.user.id, b.user.id)
        || propCompare(a.user.uri, b.user.uri)
        || propCompare(a.user.name, b.user.name)
        || 0;
}

function normalizeManifest(manifest) {
    manifest.annotations.sort(annotationCompare);
}

function fnv1aHashString(string) {
    // Returns the FNV-1a hash of a string.

    var hash = 2166136261;

    for (var i=0, c=string.length; i<c; i++) {
        hash ^= string.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return hash;
}

function getAnnotationColorForHash(hash) {
    var materialDesignPalette = [
        "#F44336",
        "#E91E63",
        "#9C27B0",
        "#673AB7",
        "#3F51B5",
        "#2196F3",
        "#03A9F4",
        "#00BCD4",
        "#009688",
        "#4CAF50",
        "#8BC34A",
        "#CDDC39",
        "#FFEB3B",
        "#FFC107",
        "#FF9800",
        "#FF5722",
        "#795548",
        "#9E9E9E",
        "#607D8B"
    ];

    var index = hash % (materialDesignPalette.length - 1);

    if (index < 0) index *= -1;

    return materialDesignPalette[index];
}
