/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "https://opensource.liveg.tech/Adapt-UI/src/adaptui.js";
import * as astronaut from "https://opensource.liveg.tech/Adapt-UI/astronaut/astronaut.js";

import * as typeset from "./typeset.js";
import * as parsers from "./parsers.js";
import "./languages/javascript.js";

const c = astronaut.components;

const STATS_TO_LOG = [];
const LAZY_RENDER_PADDING = 10;

export const renderModes = {
    FULL: 0,
    PARTIAL: 1,
    FORCE_VISIBLE: 2
};

function logStats(statsType, stats) {
    if (STATS_TO_LOG.includes(statsType)) {
        console.log(statsType, Date.now(), stats);
    }
}

export class Selection {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}

export class PositionVector {
    constructor(lineIndex = 0, columnIndex = 0) {
        /*
            First line has index 0 (`lineIndex`), but is line 1 (`line`).
            First character likewise has index 0, but is column 1 (`column`).
            `line` and `column` are to be used mainly for displaying the
            human-readable position only.
        */

        this.lineIndex = lineIndex;
        this.columnIndex = columnIndex;
    }

    get line() {
        return this.lineIndex + 1;
    }

    get column() {
        return this.columnIndex + 1;
    }

    static fromIndex(text, index) {
        var linesBeforeIndex = text.substring(0, index).split("\n");

        return new this(
            linesBeforeIndex.length - 1,
            linesBeforeIndex[linesBeforeIndex.length - 1].length
        );
    }

    toIndex(text) {
        var selectedLines = text.split("\n").slice(0, this.lineIndex + 1);

        selectedLines[selectedLines.length - 1] = selectedLines[selectedLines.length - 1].substring(0, this.columnIndex);

        // Add 1 for each line to count newlines; subtract 1 to ignore final newline
        return selectedLines.map((line) => line.length + 1).reduce((accumulator, value) => accumulator + value, 0) - 1;
    }
}

export var CodeLine = astronaut.component("CodeLine", function(props, children, inter) {
    var dirty = false;

    inter.isDirty = function() {
        return dirty;
    };

    inter.makeDirty = function() {
        dirty = true;
    };

    inter.clearDirty = function() {
        dirty = false;
    };

    inter.getParserInstance = function() {
        return props.parserInstance;
    };

    inter.setParserInstance = function(instance) {
        props.parserInstance = instance;
        dirty = true;
    };

    return c.ElementNode("typeset-line", props) (...children);
});

export var CodeToken = astronaut.component("CodeToken", function(props, children, inter) {
    props.attributes ||= {};
    props.attributes.type = props.type;

    return c.ElementNode("typeset-token", props) (...children);
});

export var CodeEditor = astronaut.component("CodeEditor", function(props, children, inter) {
    typeset.init();

    var input = c.ElementNode("textarea", {
        attributes: {
            "spellcheck": "false"
        }
    }) ();

    var linesContainer = c.ElementNode("typeset-lines") ();

    var scrollArea = c.ElementNode("typeset-scroll") (
        linesContainer
    );

    var codeContainer = c.ElementNode("typeset-code") (
        input,
        scrollArea
    );

    var lines = [];
    var oldLines = [];
    var lineCache = {};
    var lastActivity = Date.now();

    inter.getPrimarySelection = function() {
        return new Selection(input.get().selectionStart, input.get().selectionEnd);
    };

    inter.setPrimarySelection = function(selection) {
        input.get().setSelectionRange(selection.start, selection.end);
    };

    inter.getPositionVector = function(index = inter.getPrimarySelection().start) {
        return PositionVector.fromIndex(input.getValue(), index);
    };

    inter.getViewportVisibleContentsSelection = function() {
        var lineHeight = lines[0]?.get().clientHeight;

        return new Selection(
            new PositionVector(
                lines.length != 0 ? Math.floor(scrollArea.get().scrollTop / lineHeight) : 0
            ).toIndex(input.getValue()),
            new PositionVector(
                lines.length != 0 ? Math.floor((scrollArea.get().scrollTop + scrollArea.get().clientHeight) / lineHeight) : 0
            ).toIndex(input.getValue())
        );
    };

    function updateLinesContainer() {
        var updateStats = {keep: 0, add: 0, remove: 0};

        oldLines.forEach(function(line) {
            if (!lines.includes(line)) {
                line.remove();

                line.removed = true;
                updateStats.remove++;
            }
        });

        oldLines = oldLines.map((line) => line.removed ? null : line);

        var lineCount = input.getValue().split("\n").length;
        var previousLine = null;

        for (var lineIndex = 0; lineIndex < lineCount; lineIndex++) {
            if (lines[lineIndex] == oldLines[lineIndex]) {
                previousLine = lines[lineIndex];
                updateStats.keep++;

                continue;
            }

            if (previousLine != null) {
                linesContainer.get().insertBefore(lines[lineIndex].get(), previousLine.get().nextSibling);
            } else if (linesContainer.get().firstChild) {
                linesContainer.get().insertBefore(lines[lineIndex].get(), linesContainer.get().firstChild);
            } else {
                linesContainer.add(lines[lineIndex]);
            }

            previousLine = lines[lineIndex];
            updateStats.add++;
        }

        oldLines = [...lines];

        logStats("update", updateStats);
    }

    function renderLine(lineElement, previousLine = null, cache = true) {
        var parserInstance = parserInstance = lineElement.inter.getParserInstance();

        parserInstance.tokenise();

        lineElement.clear().add(
            ...parserInstance.tokens.map((token) => CodeToken({type: token.type}) (token.code))
        );

        lineElement.inter.clearDirty();

        var cacheHash = `${lineElement.getText()}|${JSON.stringify(previousLine?.inter.getParserInstance().previousState || {})}`;

        if (cache) {
            lineCache[cacheHash] = lineElement;
        }

        return lineElement;
    }

    function createLineElement(line, previousLine = null, parser = parsers.Parser, cache = true, customCacheHash = null) {
        var cacheHash = customCacheHash || `${line}|${JSON.stringify(previousLine?.inter.getParserInstance().state || {})}`;

        if (lineCache.hasOwnProperty(cacheHash)) {
            var element = lineCache[cacheHash].copy();

            element.inter = lineCache[cacheHash].inter;

            return element;
        }

        var parserInstance = new parser(
            line,
            previousLine != null ? previousLine.inter.getParserInstance().state : undefined
        );

        var element = CodeLine({parserInstance}) ();

        renderLine(element, previousLine, cache);

        return element;
    }

    inter.render = function(renderMode = renderModes.PARTIAL) {
        var previousLine = null;
        var viewportSelection = inter.getViewportVisibleContentsSelection();
        var lazyRenderMinLineIndex = PositionVector.fromIndex(input.getValue(), viewportSelection.start).lineIndex - LAZY_RENDER_PADDING;
        var lazyRenderMaxLineIndex = PositionVector.fromIndex(input.getValue(), viewportSelection.end).lineIndex + LAZY_RENDER_PADDING;
        var renderStats = {renderDirty: 0, getFromCache: 0, createUnrendered: 0, createRendered: 0};

        lines = input.getValue().split("\n").map(function(line, lineIndex) {
            var isVisible = lineIndex >= lazyRenderMinLineIndex && lineIndex <= lazyRenderMaxLineIndex;

            if (
                (
                    renderMode == renderModes.PARTIAL ||
                    (renderMode == renderModes.FORCE_VISIBLE && !isVisible)
                ) &&
                lines[lineIndex] &&
                lines[lineIndex].getText() == line
            ) {
                if (lines[lineIndex]?.inter.isDirty() && isVisible) {
                    var parser = parsers.registeredParsers[0];

                    lines[lineIndex].inter.setParserInstance(new parser(
                        line,
                        previousLine != null ? previousLine.inter.getParserInstance().state : undefined
                    ));

                    renderLine(lines[lineIndex], previousLine);

                    renderStats.renderDirty++;
                } else {
                    renderStats.getFromCache++;
                }

                previousLine = lines[lineIndex];
            } else if (lineIndex > lazyRenderMaxLineIndex && renderMode != renderModes.FULL) {
                previousLine = createLineElement(line, previousLine, parsers.DirtyParser, false, `${line}|{}`);

                previousLine.inter.makeDirty();

                renderStats.createUnrendered++;
            } else {
                previousLine = createLineElement(line, previousLine, parsers.registeredParsers[0]);

                renderStats.createRendered++;
            }

            return previousLine;
        });

        updateLinesContainer();

        logStats("render", renderStats);
    };

    input.on("input", function() {
        inter.render();

        lastActivity = Date.now();
    });

    input.on("scroll", function() {
        scrollArea.get().scrollTop = input.get().scrollTop;
        scrollArea.get().scrollLeft = input.get().scrollLeft;

        inter.render();

        lastActivity = Date.now();
    });

    setInterval(function() {
        if (Date.now() - lastActivity >= 500) {
            inter.render(renderModes.FORCE_VISIBLE);

            lastActivity = Date.now();
        }
    });

    inter.render();

    return c.ElementNode("typeset-container") (
        codeContainer
    );
});