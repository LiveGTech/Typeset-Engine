/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as parsers from "../parsers.js";

export class JavascriptParser extends parsers.Parser {
    tokenise() {
        while (this.remainingLine.length > 0) {
            if (this.matchesToken("\\/\\/.*?$")) {
                // Comment match
                this.addToken("comment");
                continue;
            }

            if (this.matchesToken("\\s+")) {
                // Whitespace match
                this.addToken("whitespace");
                continue;
            }

            if (this.matchesToken("[a-zA-Z_$][a-zA-Z0-9_$]*")) {
                this.addToken("text");
                continue;
            }

            // Fallback for now since implementation is incomplete
            this.matchesToken(".");
            this.addToken("text");
        }
    }
}

parsers.register(JavascriptParser);