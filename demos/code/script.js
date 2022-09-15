import * as astronaut from "https://opensource.liveg.tech/Adapt-UI/astronaut/astronaut.js";

import * as typeset from "../../src/typeset.js";

astronaut.unpack();

astronaut.render(
    Screen(true) (
        Section() (
            Heading() ("Typeset Code Editor Demo"),
            typeset.CodeEditor() ()
        )
    )
);