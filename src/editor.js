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
    inter.getParserInstance = function() {
        return props.parserInstance;
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

    var lines = c.ElementNode("typeset-lines") ();

    var scrollArea = c.ElementNode("typeset-scroll") (
        lines
    );

    var codeContainer = c.ElementNode("typeset-code") (
        input,
        scrollArea
    );

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

    function createLineElement(line, previousLine = null) {
        var parserInstance = new parsers.registeredParsers[0](
            line,
            previousLine != null ? previousLine.inter.getParserInstance().state : undefined
        );

        parserInstance.tokenise();

        return CodeLine({parserInstance}) (
            ...parserInstance.tokens.map((token) => CodeToken({type: token.type}) (token.code))
        );
    }

    // TODO: Find line currently being edited and then render it only (with knock-on effects observed to render other affected lines)
    function renderLine(lineIndex) {
        var line = input.getValue().split("\n")[lineIndex];
        var lineElement = $g.sel(lines.find("typeset-line").getAll()[lineIndex]);
        var parser = new parsers.registeredParsers[0](line);

        parser.tokenise();

        lineElement.clear().add(
            ...parser.tokens.map((token) => CodeToken({type: token.type}) (token.code))
        );
    }

    inter.render = function() {
        var previousLine = null;

        lines.clear().add(
            ...input.getValue().split("\n").map(function(line) {
                previousLine = createLineElement(line, previousLine);

                return previousLine;
            })
        );
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