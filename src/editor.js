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

export var CodeEditor = astronaut.component("CodeEditor", function(props, children) {
    typeset.init();

    var input = c.ElementNode("textarea") ();
    var lines = c.ElementNode("typeset-lines") ();
    var lineNumbers = c.ElementNode("typeset-linenumbers") ();

    var codeContainer = c.ElementNode("typeset-code") (
        lineNumbers,
        lines
    );

    codeContainer.on("click", function() {
        input.focus();
    });

    input.on("input", function() {
        lines.setText(input.getValue());

        lines.clear().add(
            ...input.getValue().split("\n").map((line) => c.ElementNode("typeset-line") (
                Text(line)
            ))
        );

        lineNumbers.clear().add(
            ...lines.find("typeset-line").getAll().map((line, i) => c.ElementNode("typeset-linenumber", {
                styles: {
                    "height": `${line.clientHeight}px`
                }
            }) (
                Text(i + 1)
            ))
        );
    });

    return c.ElementNode("typeset-container") (
        input,
        codeContainer
    );
});