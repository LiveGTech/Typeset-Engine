/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as parsers from "../parsers.js";

export class HtmlParser extends parsers.Parser {
    initState() {
        this.state.inBlockComment = false;
        this.state.inTag = false;
        this.state.inTagValue = false;
    }

    tokenise() {
        while (this.remainingLine.length > 0) {
            if (this.state.inBlockComment) {
                if (this.matchesToken("-->")) {
                    // Block comment close match

                    this.state.inBlockComment = false;

                    this.addToken("comment");

                    continue;
                }

                this.matchesToken("(?:[->]+|.)");
                this.addToken("comment");

                continue;
            }

            if (this.state.inTagValue) {
                if (this.matchesToken("\"[^\"]*\"") || this.matchesToken("'[^']*'")) {
                    // Explicit attribute value string

                    this.state.inTagValue = false;

                    this.addToken("string");

                    continue;
                }

                if (this.matchesToken(">")) {
                    // Tag end

                    this.state.inTag = false;
                    this.state.inTagValue = false;

                    this.addToken("syntaxSymbol");

                    continue;
                }

                // Implicit attribute value string

                this.state.inTagValue = false;

                this.matchesToken("[^>\\s]*");
                this.addToken("string");

                continue;
            }

            if (this.state.inTag) {
                if (this.matchesToken("[^=>\"']+", "\\s*=\\s*")) {
                    // Attribute name with associated value
                    this.addToken("identifier");

                    this.matchesToken("\\s*=\\s*");
                    this.addToken("syntaxSymbol");

                    this.state.inTagValue = true;

                    continue;
                }

                if (this.matchesToken("[^=>\"'\\s]+")) {
                    // Attribute name
                    this.addToken("identifier");

                    continue;
                }

                if (this.matchesToken(">")) {
                    // Tag end

                    this.state.inTag = false;

                    this.addToken("syntaxSymbol");

                    continue;
                }

                // Fallback for text
                this.matchesToken(".");
                this.addToken("text");

                continue;
            }

            if (this.matchesToken("<!--")) {
                // Block comment open match

                this.state.inBlockComment = true;

                this.addToken("comment");

                continue;
            }

            if (this.matchesToken("<\\/?", "[^<>\"'\\s]+")) {
                // Tag symbol
                this.addToken("syntaxSymbol");

                // Tag name
                this.matchesToken("[^<>\"'\\s]+");
                this.addToken("keyword");

                this.state.inTag = true;

                continue;
            }

            if (this.matchesToken("[^<>]+")) {
                // Generic text
                this.addToken("text");
                continue;
            }

            // Fallback for text
            this.matchesToken(".");
            this.addToken("text");
        }
    }
}

parsers.register("html", HtmlParser);