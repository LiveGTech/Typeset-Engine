/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "https://opensource.liveg.tech/Adapt-UI/src/adaptui.js";
import * as astronaut from "https://opensource.liveg.tech/Adapt-UI/astronaut/astronaut.js";

import * as typeset from "./typeset.js";
import * as common from "./common.js";
import * as parsers from "./parsers.js";
import "./languages/javascript.js";

const c = astronaut.components;

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
}

export var CodeLine = astronaut.component("CodeLine", function(props, children, inter) {
    var dirty = false;

    inter.getParserInstance = function() {
        return props.parserInstance;
    };

    // TODO: Use this for rendering viewport only as opposed to whole code
    inter.isDirty = function() {
        return dirty;
    };

    inter.makeDirty = function() {
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
    var lineCache = {};

    inter.getPrimarySelection = function() {
        return new Selection(input.get().selectionStart, input.get().selectionEnd);
    };

    inter.setPrimarySelection = function(selection) {
        input.get().setSelectionRange(selection.start, selection.end);
    };

    inter.getPositionVector = function(index = inter.getPrimarySelection().start) {
        var linesBeforeIndex = input.getValue().substring(0, index).split("\n");

        return new PositionVector(
            linesBeforeIndex.length - 1,
            linesBeforeIndex[linesBeforeIndex.length - 1].length
        );
    };

    function updateLinesContainer() {
        linesContainer.clear().add(...lines);
    }

    function createLineElement(line, previousLine = null) {
        var cacheHash = `${line}|${JSON.stringify(previousLine?.inter.getParserInstance().state || {})}`;

        if (lineCache.hasOwnProperty(cacheHash)) {
            var element = lineCache[cacheHash].copy();

            element.inter = lineCache[cacheHash].inter;

            return element;
        }

        var parserInstance = new parsers.registeredParsers[0](
            line,
            previousLine != null ? previousLine.inter.getParserInstance().state : undefined
        );

        parserInstance.tokenise();

        var element = CodeLine({parserInstance}) (
            ...parserInstance.tokens.map((token) => CodeToken({type: token.type}) (token.code))
        );

        lineCache[cacheHash] = element;

        return element;
    }

    // TODO: Find line currently being edited and then render it only (with knock-on effects observed to render other affected lines)
    function renderLine(lineIndex = inter.getPositionVector().lineIndex) {
        var line = input.getValue().split("\n")[lineIndex];
        var lineElement = lines[lineIndex];
        var parser = new parsers.registeredParsers[0](line);

        parser.tokenise();

        lineElement.clear().add(
            ...parser.tokens.map((token) => CodeToken({type: token.type}) (token.code))
        );

        return lineElement;
    }

    inter.render = function() {
        var previousLine = null;

        lines = input.getValue().split("\n").map(function(line) {
            previousLine = createLineElement(line, previousLine);

            return previousLine;
        });

        updateLinesContainer();
    };

    input.on("input", function() {
        inter.render();
    });

    input.on("scroll", function() {
        scrollArea.get().scrollTop = input.get().scrollTop;
        scrollArea.get().scrollLeft = input.get().scrollLeft;
    });

    inter.render();

    return c.ElementNode("typeset-container") (
        codeContainer
    );
});