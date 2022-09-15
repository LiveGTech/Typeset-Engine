/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "https://opensource.liveg.tech/Adapt-UI/src/adaptui.js";

export * from "./editor.js";

var initCalled = false;

export function init() {
    initCalled = true;

    $g.waitForLoad().then(function() {
        $g.sel("head").add(
            $g.create("link")
                .setAttribute("rel", "stylesheet")
                .setAttribute("href", "https://opensource.liveg.tech/Adapt-UI/src/adaptui.css")
            ,
            $g.create("link")
                .setAttribute("rel", "stylesheet")
                .setAttribute("href", `${import.meta.url}/../typeset.css`)
        );
    });
}