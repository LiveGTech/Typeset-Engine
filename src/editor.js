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
import "./languages/json.js";
import "./languages/html.js";
import "./languages/css.js";

const c = astronaut.components;

const STATS_TO_LOG = [];
const LAZY_RENDER_PADDING = 10;

const diffResults = {
    SAME: 0,
    ADDED: 1,
    REMOVED: 2,
    MODIFIED: 3
};

export const renderModes = {
    FULL: 0,
    PARTIAL: 1,
    FORCE_VISIBLE: 2,
    FORCE_VISIBLE_AND_DIRTY: 3
};

function logStats(statsType, stats) {
    if (STATS_TO_LOG.includes(statsType)) {
        console.log(statsType, Date.now(), stats);
    }
}

function getDiff(previousLines, currentLines) {
    var diff = [];
    var previousQueue = [...previousLines];
    var currentQueue = [...currentLines];

    while (currentQueue.length > 0 || previousQueue.length > 0) {
        if (previousQueue.length == 0) {
            diff.push(diffResults.ADDED);

            currentQueue.shift();

            continue;
        }

        if (currentQueue.length == 0) {
            diff.push(diffResults.REMOVED);

            previousQueue.shift();

            continue;
        }

        if (currentQueue[0] == previousQueue[0]) {
            diff.push(diffResults.SAME);

            currentQueue.shift();
            previousQueue.shift();

            continue;
        }

        if (currentQueue.includes(previousQueue[0])) {
            while (currentQueue[0] != previousQueue[0]) {
                diff.push(diffResults.ADDED);

                currentQueue.shift();
            }

            continue;
        }

        if (previousQueue.includes(currentQueue[0])) {
            while (previousQueue[0] != currentQueue[0]) {
                diff.push(diffResults.REMOVED);

                previousQueue.shift();
            }

            continue;
        }

        diff.push(diffResults.MODIFIED);

        currentQueue.shift();
        previousQueue.shift();
    }

    return diff;
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

        // If there are no lines in index range, then return the maximum text length
        if (selectedLines.length == 0) {
            return text.length;
        }

        selectedLines[selectedLines.length - 1] = selectedLines[selectedLines.length - 1].substring(0, this.columnIndex);

        // Add 1 for each line to count newlines; subtract 1 to ignore final newline
        return selectedLines.map((line) => line.length + 1).reduce((accumulator, value) => accumulator + value, 0) - 1;
    }
}

export class Line {
    constructor(code, parserClass, previousLine = null) {
        this.code = code;

        this.parserInstance = new parserClass(
            code,
            previousLine != null ? previousLine.state : undefined
        );

        this.parserInstance.tokenise();
    }

    static areSameStates(a, b) {
        return JSON.stringify(a?.state) == JSON.stringify(b?.state);
    }

    get state() {
        return this.parserInstance.state;
    }

    render() {
        return CodeLine() (
            ...this.parserInstance.tokens.map((token) => CodeToken({type: token.type}) (token.code))
        );
    }
}

export var CodeLine = astronaut.component("CodeLine", function(props, children, inter) {
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

    var editorContainer = c.ElementNode("typeset-container", {
        attributes: {
            "dir": "ltr"
        }
    }) (
        codeContainer
    );

    var previousLines = [];
    var previousCodeLines = [];
    var lineElements = [];
    var parserClass = parsers.registeredParsers[props.language] || parsers.Parser;

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
        var lineHeight = lineElements[0]?.get().clientHeight;

        return new Selection(
            new PositionVector(
                lineElements.length != 0 ? Math.floor(scrollArea.get().scrollTop / lineHeight) : 0
            ).toIndex(input.getValue()),
            new PositionVector(
                lineElements.length != 0 ? Math.floor((scrollArea.get().scrollTop + scrollArea.get().clientHeight) / lineHeight) : 0
            ).toIndex(input.getValue())
        );
    };
    
    inter.render = function(renderMode = renderModes.PARTIAL) {
        // TODO: Implement lazy rendering

        var codeLines = input.getValue().split("\n");
        var viewportSelection = inter.getViewportVisibleContentsSelection();
        var lazyRenderMinLineIndex = PositionVector.fromIndex(input.getValue(), viewportSelection.start).lineIndex - LAZY_RENDER_PADDING;
        var lazyRenderMaxLineIndex = PositionVector.fromIndex(input.getValue(), viewportSelection.end).lineIndex + LAZY_RENDER_PADDING;
        var renderStats = {remove: 0, getFromCache: 0, createRendered: 0};

        var previousLine = null;
        var lineDiff = getDiff(previousCodeLines, codeLines);
        var lines = [];
        var currentLineIndex = 0;
        var currentPreviousLineIndex = 0;
        var currentLineElements = linesContainer.find("typeset-line").items();
        var lineElementsToRemove = [];

        lineDiff.forEach(function(result) {
            var newLine = null;

            if (result == diffResults.REMOVED) {
                lineElementsToRemove.push(currentLineElements[currentPreviousLineIndex]);

                renderStats.remove++;
            } else {
                var useCached = (
                    result == diffResults.SAME &&
                    codeLines[currentLineIndex] == previousLines[currentPreviousLineIndex]?.code &&
                    Line.areSameStates(previousLine, previousLines[currentPreviousLineIndex - 1])
                );

                newLine = (
                    useCached ?
                    previousLines[currentPreviousLineIndex] :
                    new Line(codeLines[currentLineIndex], parserClass, previousLine)
                );

                lines.push(newLine);

                if (useCached) {
                    renderStats.getFromCache++;
                } else {
                    renderStats.createRendered++;

                    if (result == diffResults.ADDED) {
                        if (currentLineElements.length == 0) {
                            linesContainer.add(newLine.render());
                        } else {
                            linesContainer.get().insertBefore(newLine.render().get(), currentLineElements[currentPreviousLineIndex]?.get());
                        }
                    } else {
                        currentLineElements[currentPreviousLineIndex].clear().add(...newLine.render().find(":scope > *").items());
                    }
                }

                previousLine = newLine;
                currentLineIndex++;
            }

            if (result != diffResults.ADDED) {
                currentPreviousLineIndex++;
            }
        });

        lineElementsToRemove.forEach((element) => element.remove());

        lineElements = linesContainer.find("typeset-line").items();
        previousLines = lines;
        previousCodeLines = codeLines;

        codeContainer.get().style.setProperty(
            "--typeset-lineNumberChars",
            `${Math.max(String(lineElements.length).length, 3)}`
        );

        logStats("render", renderStats);
    };

    input.on("input", function() {
        inter.render();
    });

    input.on("scroll", function() {
        scrollArea.get().scrollTop = input.get().scrollTop;
        scrollArea.get().scrollLeft = input.get().scrollLeft;

        inter.render();
    });

    input.setValue(props.code || "");

    if (props.readOnly) {
        input.setAttribute("disabled", true);
    }

    if (props.adaptiveHeight) {
        editorContainer.setAttribute("adaptiveheight", true);
    }

    inter.render();

    return editorContainer;
});