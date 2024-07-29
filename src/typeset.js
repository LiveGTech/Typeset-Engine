/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

const AUI_URL_PREFIX = self.TYPESET_ENGINE_AUI_URL_PREFIX || "https://opensource.liveg.tech/Adapt-UI";

var $g = await import(`${AUI_URL_PREFIX}/src/adaptui.js`);

export * from "./editor.js";

var initCalled = false;

export function init() {
    if (initCalled) {
        return;
    }

    initCalled = true;

    $g.waitForLoad().then(function() {
        $g.sel("head").add(
            $g.create("link")
                .setAttribute("rel", "stylesheet")
                .setAttribute("href", `${AUI_URL_PREFIX}/src/adaptui.css`)
            ,
            $g.create("link")
                .setAttribute("rel", "stylesheet")
                .setAttribute("href", `${import.meta.url}/../typeset.css`)
        );
    });
}