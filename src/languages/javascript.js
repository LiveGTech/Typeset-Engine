/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as parsers from "../parsers.js";

const KEYWORDS = ["as", "await", "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete", "do", "else", "enum", "export", "extends", "finally", "for", "from", "function", "get", "if", "implements", "import", "in", "instanceof", "interface", "let", "new", "package", "private", "protected", "public", "return", "set", "switch", "static", "throw", "try", "typeof", "var", "void", "while", "with", "yield"];
const VALUE_KEYWORDS = ["constructor", "false", "Infinity", "NaN", "null", "super", "this", "true", "undefined"];
const OPERATORS = ["===", "!==", "==", "!=", "=", "+=", "++", "+", "-=", "--", "-", "*=", "*", "/=", "/", "%=", "%", "**=", "**", "<<=", "<<", "<=", "<", ">>>=", ">>>", ">>=", ">>", ">=", ">", "&&=", "&&", "&=", "&", "^=", "^", "||=", "||", "|=", "|", "??=", "??"];

export class JavascriptParser extends parsers.Parser {
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

    get inTemplatePlaceholderBelow() {
        if (this.state.stringStack.length < 2) {
            return false;
        }

        return this.state.stringStack[this.state.stringStack.length - 2].inTemplatePlaceholder;
    }

    pushStringStateStackDefaults() {
        this.state.stringStack.push({
            stringOpener: null,
            inTemplateString: false,
            inTemplatePlaceholder: false
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

            if (this.stringStackLast.stringOpener != null && !this.stringStackLast.inTemplatePlaceholder) {
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

                if (this.stringStackLast.inTemplateString && this.matchesToken("\\$\\{")) {
                    // Template placeholder open match

                    this.stringStackLast.inTemplatePlaceholder = true;

                    this.pushStringStateStackDefaults();

                    this.addToken("string");

                    continue;
                }

                if (this.matchesTokenString(this.stringStackLast.stringOpener)) {
                    // String close match

                    this.stringStackLast.stringOpener = null;
                    this.stringStackLast.inTemplateString = false;

                    this.addToken("string");

                    continue;
                }

                // String body match

                this.matchesToken("(?:[^\"'`\\\\\\$]+|.)");
                this.addToken("string");

                continue;
            }

            if (this.inTemplatePlaceholderBelow && this.matchesToken("\\}")) {
                // Template placeholder close match

                this.state.stringStack.pop();

                this.stringStackLast.inTemplatePlaceholder = false;

                this.addToken("string");

                continue;
            }

            if (this.matchesToken("`")) {
                // Template string open match

                this.stringStackLast.stringOpener = this.currentToken;
                this.stringStackLast.inTemplateString = true;

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

            if (this.currentToken != "." && this.matchesToken(`\\b(?:${KEYWORDS.join("|")})\\b`)) {
                // Keyword match
                this.addToken("keyword");
                continue;
            }

            if (this.currentToken != "." && this.matchesToken(`\\b(?:${VALUE_KEYWORDS.join("|")})\\b`)) {
                // Keyword match
                this.addToken("valueKeyword");
                continue;
            }

            if (this.matchesToken("[a-zA-Z_$][a-zA-Z0-9_$]*", "\\s*\\(")) {
                // Function call identifier
                this.addToken("callIdentifier");
                continue;
            }

            if (this.matchesToken("[a-zA-Z_$][a-zA-Z0-9_$]*")) {
                // Generic identifier
                this.addToken("identifier");
                continue;
            }

            if (this.matchesTokens(OPERATORS)) {
                // Operator
                this.addToken("operator");
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

parsers.register(JavascriptParser);