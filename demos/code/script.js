import * as astronaut from "https://opensource.liveg.tech/Adapt-UI/astronaut/astronaut.js";

import * as typeset from "../../src/typeset.js";

astronaut.unpack();

typeset.init();

fetch("../../src/editor.js").then(function(response) {
    return response.text();
}).then(function(exampleCode) {
    astronaut.render(
        Screen(true) (
            Page(true) (
                Section() (
                    Heading() ("Typeset Code Editor Demo"),
                    typeset.CodeEditor({
                        language: "javascript",
                        code: exampleCode
                    }) ()
                )
            )
        )
    );
});