/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as parsers from "../parsers.js";

const VALUE_KEYWORDS = ["false", "Infinity", "NaN", "null", "true"];

export class JsonParser extends parsers.Parser {
    initState() {
        this.state.stringStack = [];
        this.state.inStringNewlineEscape = false;
        this.state.inBlockComment = false;

        this.pushStringStateStackDefaults();
    }

    get stringStackLast() {
        return this.state.stringStack[this.state.stringStack.length - 1];
    }

    set stringStackLast(value) {
        this.state.stringStack[this.state.stringStack.length - 1] = value;
    }

    pushStringStateStackDefaults() {
        this.state.stringStack.push({
            stringOpener: null
        });
    }

    tokenise() {
        this.state.inStringNewlineEscape = false;

        while (this.remainingLine.length > 0) {
            if (this.state.inBlockComment) {
                if (this.matchesToken("\\*\\/")) {
                    // Block comment close match

                    this.state.inBlockComment = false;

                    this.addToken("comment");

                    continue;
                }

                this.matchesToken("(?:[\\/*]+|.)");
                this.addToken("comment");

                continue;
            }

            if (this.stringStackLast.stringOpener != null) {
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

                    this.state.inStringNewlineEscape = true;

                    this.addToken("escape");

                    continue;
                }

                if (this.matchesToken("\\\\[bfnrtv0'\"`\\$\\\\]")) {
                    // Escape match
                    this.addToken("escape");
                    continue;
                }

                if (this.matchesTokenString(this.stringStackLast.stringOpener)) {
                    // String close match

                    this.stringStackLast.stringOpener = null;

                    this.addToken("string");

                    continue;
                }

                // String body match

                this.matchesToken("(?:[^\"'`\\\\\\$]+|.)");
                this.addToken("string");

                continue;
            }

            if (this.matchesToken("\"|'")) {
                // String open match

                this.stringStackLast.stringOpener = this.currentToken;

                this.addToken("string");

                continue;
            }

            if (this.matchesToken("\\/\\*")) {
                // Block comment open match

                this.state.inBlockComment = true;

                this.addToken("comment");

                continue;
            }

            if (this.matchesToken("\\/\\/.*?$")) {
                // Comment match
                this.addToken("comment");
                continue;
            }

            if (this.matchesToken(`\\(|\\)|\\{|\\}|\\[|\\]`)) {
                // Bracket match
                // TODO: Classify opening/closing brackets and bracket type
                this.addToken("bracket");
                continue;
            }

            if (this.currentToken != "." && this.matchesToken(`\\b(?:${VALUE_KEYWORDS.join("|")})\\b`)) {
                // Keyword match
                this.addToken("valueKeyword");
                continue;
            }

            if (this.matchesToken("[a-zA-Z_$][a-zA-Z0-9_$]*")) {
                // Generic identifier
                this.addToken("identifier");
                continue;
            }

            if (
                this.matchesToken("0(x|X)[0-9a-fA-F]+n?") || // Hexadecimal numbers
                this.matchesToken("0(b|B)[01]+n?") || // Binary numbers
                this.matchesToken("0[0-7]+n?") || // Octal numbers
                this.matchesToken("[+-]?(?:(?:\\b[0-9]+(\\.)[0-9]+[eE][+-]?[0-9]+\\b)(?:\\b[0-9]+(\\.)[eE][+-]?[0-9]+\\b)|(?:\\B(\\.)[0-9]+[eE][+-]?[0-9]+\\b)|(?:\\b[0-9]+[eE][+-]?[0-9]+\\b)|(?:\\b[0-9]+(\\.)[0-9]+\\b)|(?:\\b[0-9]+(\\.)\\B)|(?:\\B(\\.)[0-9]+\\b)|(?:\\b[0-9]+))n?") // Scientific format numbers
            ) {
                // Number literal match
                this.addToken("number");
                continue;
            }

            if (this.matchesToken("\\s+")) {
                // Whitespace match
                this.addToken("whitespace");
                continue;
            }

            // Fallback for now since implementation is incomplete
            this.matchesToken(".");
            this.addToken("text");
        }

        if (!this.stringStackLast.inTemplateString && !this.state.inStringNewlineEscape) {
            this.stringStackLast.stringOpener = null;
        }
    }
}

parsers.register("json", JsonParser);