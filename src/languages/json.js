/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as parsers from "../parsers.js";

const VALUE_KEYWORDS = ["false", "Infinity", "NaN", "null", "true"];

const BRACKET_TYPES = {
    "(": {type: "expression", opening: true},
    ")": {type: "expression", opening: false},
    "{": {type: "object", opening: true},
    "}": {type: "object", opening: false},
    "[": {type: "array", opening: true},
    "]": {type: "array", opening: false}
};

export class JsonParser extends parsers.Parser {
    initState() {
        this.state.stringStack = [];
        this.state.bracketStack = [];
        this.state.inStringNewlineEscape = false;
        this.state.inBlockComment = false;
        this.state.inObjectKey = false;

        this.pushStringStateStackDefaults();
        this.pushBracketStateStackDefaults();
    }

    get stringStackLast() {
        return this.state.stringStack[this.state.stringStack.length - 1];
    }

    set stringStackLast(value) {
        this.state.stringStack[this.state.stringStack.length - 1] = value;
    }

    pushStringStateStackDefaults() {
        this.state.stringStack.push({
            stringOpener: null,
            isKeyString: false
        });
    }

    get bracketStackLast() {
        return this.state.bracketStack[this.state.bracketStack.length - 1];
    }

    set bracketStackLast(value) {
        this.state.bracketStack[this.state.bracketStack.length - 1] = value;
    }

    pushBracketStateStackDefaults() {
        this.state.bracketStack.push({
            type: null,
            opening: true
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

                    this.addToken(this.state.inObjectKey ? "identifier" : "string");

                    continue;
                }

                // String body match

                this.matchesToken("(?:[^\"'`\\\\\\$]+|.)");
                this.addToken(this.state.inObjectKey ? "identifier" : "string");

                continue;
            }

            if (this.matchesToken("\"|'")) {
                // String open match

                this.stringStackLast.stringOpener = this.currentToken;
                this.stringStackLast.isKeyString = false;

                this.addToken(this.state.inObjectKey ? "identifier" : "string");

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

            if (this.matchesTokens(Object.keys(BRACKET_TYPES))) {
                // Bracket match

                this.addToken("bracket");

                var bracket = BRACKET_TYPES[this.currentToken];

                if (bracket.opening) {
                    this.state.bracketStack.push(bracket);
                } else if (this.state.bracketStack.length > 1) {
                    this.state.bracketStack.pop();
                }

                this.state.inObjectKey = this.bracketStackLast.type == "object";

                // TODO: We should check for bracket mismatches and highlight syntax errors here

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

            if (this.matchesToken(":")) {
                this.state.inObjectKey = false;

                this.addToken("assignment");

                continue;
            }

            if (this.matchesToken(",") && this.bracketStackLast.type == "object") {
                this.state.inObjectKey = true;

                this.addToken("separator");

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

        if (!this.state.inStringNewlineEscape) {
            this.stringStackLast.stringOpener = null;
        }
    }
}

parsers.register("json", JsonParser);