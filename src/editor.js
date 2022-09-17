/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "https://opensource.liveg.tech/Adapt-UI/src/adaptui.js";
import * as astronaut from "https://opensource.liveg.tech/Adapt-UI/astronaut/astronaut.js";

import * as typeset from "./typeset.js";

const c = astronaut.components;

export class Selection {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}

export var CodeEditor = astronaut.component("CodeEditor", function(props, children, inter) {
    typeset.init();

    var input = c.ElementNode("textarea") ();
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

    input.on("input", function() {
        lines.setText(input.getValue());

        lines.clear().add(
            ...input.getValue().split("\n").map((line) => c.ElementNode("typeset-line") (
                Text(line)
            ))
        );
    });

    input.on("scroll", function() {
        scrollArea.get().scrollTop = input.get().scrollTop;
        scrollArea.get().scrollLeft = input.get().scrollLeft;
    });

    return c.ElementNode("typeset-container") (
        codeContainer
    );
});