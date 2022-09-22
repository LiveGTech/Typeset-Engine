/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as parsers from "../parsers.js";

const KEYWORDS = ["await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum", "export", "extends", "false", "finally", "for", "function", "if", "implements", "import", "in", "instanceof", "interface", "let", "new", "null", "package", "private", "protected", "public", "return", "super", "switch", "static", "this", "throw", "try", "True", "typeof", "var", "void", "while", "with", "yield"];

export class JavascriptParser extends parsers.Parser {
    initState() {
        this.state.stringOpener = null;
        this.state.inTemplateString = false;
    }

    tokenise() {
        while (this.remainingLine.length > 0) {
            if (this.state.stringOpener != null) {
                if (this.matchesToken("\\\\(?:[0-7]{2,3}|[1-7][0-7]{0,2})")) {
                    // Octal escape match
                    this.addToken("escape");
                    continue;
                }

                if (this.matchesToken("\\\\x[0-9a-fA-F]{2}")) {
                    // Hexadecimal escape match
                    this.addToken("escape");
                    continue;
                }

                if (this.matchesToken("\\\\u(?:[0-9a-fA-F]{4}|\\{[0-9a-fA-F]+\\})")) {
                    // Unicode escape match
                    this.addToken("escape");
                    continue;
                }

                if (this.matchesToken("\\\\$")) {
                    // End-of-line escape match
                    this.addToken("escape");
                    continue;
                }

                if (this.matchesToken("\\\\[bfnrtv0'\"\\\\]")) {
                    // Escape match
                    this.addToken("escape");
                    continue;
                }

                if (this.matchesTokenString(this.state.stringOpener)) {
                    // String close match

                    this.addToken("string");

                    this.state.stringOpener = null;
                    this.state.inTemplateString = false;

                    continue;
                }

                // String body match

                this.matchesToken("(?:[^\"'`\\\\]+|.)");
                this.addToken("string");

                continue;
            }

            if (this.matchesToken("`")) {
                // Template string open match

                this.state.stringOpener = this.currentToken;
                this.state.inTemplateString = true;

                this.addToken("string");

                continue;
            }

            if (this.matchesToken("\"|'")) {
                // String open match

                this.state.stringOpener = this.currentToken;

                this.addToken("string");

                continue;
            }

            if (this.matchesToken("\\/\\/.*?$")) {
                // Comment match
                this.addToken("comment");
                continue;
            }

            if (this.matchesToken(`\\b(?:${KEYWORDS.join("|")})\\b`)) {
                // Keyword match
                this.addToken("keyword");
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

        if (!this.state.inTemplateString) {
            this.state.stringOpener = null;
        }
    }
}

parsers.register(JavascriptParser);