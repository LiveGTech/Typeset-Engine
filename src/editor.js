/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const AUI_URL_PREFIX = self.TYPESET_ENGINE_AUI_URL_PREFIX || "https://opensource.liveg.tech/Adapt-UI";

var $g = await import(`${AUI_URL_PREFIX}/src/adaptui.js`);
var astronaut = await import(`${AUI_URL_PREFIX}/astronaut/astronaut.js`);

import * as typeset from "./typeset.js";
import * as parsers from "./parsers.js";

import "./languages/javascript.js";
import "./languages/json.js";
import "./languages/html.js";
import "./languages/css.js";

const c = astronaut.components;

const STATS_TO_LOG = [];
const LAZY_RENDER_PADDING = 10;

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

    clone() {
        return new this.constructor(this.lineIndex, this.columnIndex);
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

    var input = c.TextInputArea({
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

    var lines = [];
    var oldLines = [];
    var lineCache = {};
    var lastActivity = Date.now();
    var parserClass = parsers.registeredParsers[props.language] || parsers.Parser;
    var indentString = props.indentString || "    ";
    var nextTabMovesFocus = false;

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
                    (renderMode == renderModes.FORCE_VISIBLE && !isVisible) ||
                    (renderMode == renderModes.FORCE_VISIBLE_AND_DIRTY && (!isVisible || lines[lineIndex]?.inter.isDirty()))
                ) &&
                lines[lineIndex] &&
                lines[lineIndex].getText() == line
            ) {
                if (lines[lineIndex]?.inter.isDirty() && isVisible) {
                    lines[lineIndex].inter.setParserInstance(new parserClass(
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
                previousLine = createLineElement(line, previousLine, parserClass);

                renderStats.createRendered++;
            }

            return previousLine;
        });

        updateLinesContainer();

        codeContainer.get().style.setProperty(
            "--typeset-lineNumberChars",
            `${Math.max(String(lines.length).length, 3)}`
        );

        logStats("render", renderStats);
    };

    inter.getCode = function() {
        return input.getValue();
    };

    inter.setCode = function(code) {
        input.setValue(code);

        inter.render();
    };

    input.on("keydown", function(event) {
        if (["Tab", "Backspace"].includes(event.code)) {
            if (props.noSmartIndentation) {
                return;
            }

            if (event.code == "Tab" && nextTabMovesFocus) {
                // TODO: Add checks to see if gShell Switch Navigation causes this event

                nextTabMovesFocus = false;

                return;
            }

            var startPosition = inter.getPositionVector(inter.getPrimarySelection().start);
            var endPosition = inter.getPositionVector(inter.getPrimarySelection().end);
            var allLines = inter.getCode().split("\n");
            var selectedLines = allLines.slice(startPosition.lineIndex, endPosition.lineIndex + 1);
            var newStartPosition = startPosition.clone();
            var newEndPosition = endPosition.clone();

            if (event.code == "Tab" && !event.shiftKey && selectedLines.length == 1) { // Add tab to current line at selection
                var distanceToNextTabStop = indentString.length - (selectedLines[0].substring(0, startPosition.columnIndex).length % indentString.length);

                event.preventDefault();

                selectedLines[0] = selectedLines[0].substring(0, startPosition.columnIndex) + indentString.substring(0, distanceToNextTabStop) + selectedLines[0].substring(endPosition.columnIndex);

                newStartPosition.columnIndex += distanceToNextTabStop;
                newEndPosition.columnIndex += distanceToNextTabStop - (endPosition.columnIndex - startPosition.columnIndex);
            }

            if (event.code == "Tab" && !event.shiftKey && selectedLines.length != 1) { // Indent all selected lines if more than one line is selected
                event.preventDefault();

                newStartPosition.columnIndex += indentString.length;
                newEndPosition.columnIndex += indentString.length;

                selectedLines.forEach(function(line, i) {
                    selectedLines[i] = indentString + line;
                });
            }

            if (event.code == "Tab" && event.shiftKey) { // Dedent all selected lines
                event.preventDefault();

                selectedLines.forEach(function(line, i) {
                    var newLineStart = 0;
                    var startWhitespaceMatch = line.match(/^\s+/);

                    if (line.startsWith(indentString)) {
                        newLineStart = indentString.length;
                    } else if (
                        indentString.match(/^\s+$/) && // Indent is whitespace only
                        startWhitespaceMatch && // Some whitespace matches at start
                        startWhitespaceMatch[0].length < indentString.length // Whitespace at start is shorter than indent string
                    ) {
                        newLineStart = startWhitespaceMatch[0].length;
                    }

                    if (newLineStart == 0) {
                        return;
                    }

                    selectedLines[i] = line.substring(newLineStart);

                    if (i == 0) {
                        newStartPosition.columnIndex -= newLineStart;
                    }

                    if (i == selectedLines.length - 1) {
                        newEndPosition.columnIndex -= newLineStart;
                    }
                });
            }

            if (event.code == "Backspace" && !event.shiftKey && selectedLines.length == 1) { // Dedent line if backspace from end of indent
                var line = selectedLines[0].substring(0, endPosition.columnIndex);
                var lineRemaining = line;
                var indentCount = 0;

                while (lineRemaining.startsWith(indentString)) {
                    lineRemaining = lineRemaining.substring(indentString.length);
                    indentCount++;
                }

                if (indentCount > 0 && endPosition.columnIndex <= indentString.length * indentCount) {
                    event.preventDefault();

                    selectedLines[0] = selectedLines[0].substring(indentString.length);

                    newStartPosition.columnIndex -= indentString.length;
                    newEndPosition.columnIndex -= indentString.length;
                }
            }

            selectedLines.forEach(function(newLine, i) {
                allLines[startPosition.lineIndex + i] = newLine;
            });

            inter.setCode(allLines.join("\n"));

            inter.setPrimarySelection(new Selection(newStartPosition.toIndex(inter.getCode()), newEndPosition.toIndex(inter.getCode())));
        }

        nextTabMovesFocus = false;

        if (event.code == "Escape") {
            nextTabMovesFocus = true;
        }
    });

    input.on("keyup", function(event) {
        if (event.code == "Enter" && !event.shiftKey) { // Indent subsequent lines
            if (props.noSmartIndentation) {
                return;
            }

            var startPosition = inter.getPositionVector(inter.getPrimarySelection().start);
            var endPosition = inter.getPositionVector(inter.getPrimarySelection().end);
            var allLines = inter.getCode().split("\n");
            var previousLine = allLines[startPosition.lineIndex - 1];
            var previousLineRemaining = previousLine;
            var indentCount = 0;

            while (previousLineRemaining.startsWith(indentString)) {
                previousLineRemaining = previousLineRemaining.substring(indentString.length);
                indentCount++;
            }

            allLines[startPosition.lineIndex] = indentString.repeat(indentCount) + allLines[startPosition.lineIndex];

            startPosition.columnIndex += indentString.length * indentCount;
            endPosition.columnIndex += indentString.length * indentCount;

            if (previousLineRemaining.length == 0) { // Automatically clear lines that contain indentation only
                allLines[startPosition.lineIndex - 1] = "";
            }

            inter.setCode(allLines.join("\n"));

            inter.setPrimarySelection(new Selection(startPosition.toIndex(inter.getCode()), endPosition.toIndex(inter.getCode())));
        }
    })

    input.on("input", function() {
        var previousState = JSON.stringify(lines[inter.getPositionVector().lineIndex]?.inter.getParserInstance().state);

        inter.render();

        lastActivity = Date.now();

        if (previousState != JSON.stringify(lines[inter.getPositionVector().lineIndex]?.inter.getParserInstance().state)) {
            for (var lineIndex = inter.getPositionVector().lineIndex; lineIndex < lines.length; lineIndex++) {
                lines[lineIndex]?.inter.makeDirty();
            }

            inter.render(renderModes.FORCE_VISIBLE);
        }

        editorContainer.emit("input");
    });

    input.on("scroll", function() {
        scrollArea.get().scrollTop = input.get().scrollTop;
        scrollArea.get().scrollLeft = input.get().scrollLeft;

        inter.render();

        lastActivity = Date.now();
    });

    setInterval(function() {
        if (Date.now() - lastActivity >= 500) {
            inter.render(renderModes.FORCE_VISIBLE_AND_DIRTY);

            lastActivity = Date.now();
        }
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