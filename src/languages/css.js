/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as parsers from "../parsers.js";

const COMPARATORS = ["~=", "|=", "^=", "$=", "*=", "="];
const OPERATORS = ["+", "-", "*", "/", ">", "~"];

export class CssParser extends parsers.Parser {
    initState() {
        this.state.inBlockComment = false;
        this.state.inAtRule = false;
        this.state.inRule = false;
        this.state.inAttributeSelector = false;
        this.state.afterComparator = false;
        this.state.currentStringOpener = null;
    }

    tokenise() {
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

            if (this.matchesToken("{")) {
                // Rule open match

                this.state.inRule = true;

                this.addToken("text");

                continue;
            }

            if (this.matchesToken("}")) {
                // Rule close match

                this.state.inRule = false;

                this.addToken("text");

                continue;
            }

            if (this.matchesToken("\\[")) {
                // Attribute selector open match

                this.state.inAttributeSelector = true;

                this.addToken("text");

                continue;
            }

            if (this.matchesToken("\\]")) {
                // Attribute selector close match

                this.state.inAttributeSelector = false;

                this.addToken("text");

                continue;
            }

            if (this.matchesToken("\\/\\*")) {
                // Block comment open match

                this.state.inBlockComment = true;

                this.addToken("comment");

                continue;
            }

            if (this.matchesToken("\\\\[\"':]")) {
                // Escape match
                this.addToken("escape");
                continue;
            }

            if (this.state.currentStringOpener != null) {
                if (this.matchesTokenString(this.state.currentStringOpener)) {
                    // Closing string match

                    this.state.currentStringOpener = null;

                    this.addToken("string");

                    continue;
                }

                // String text match

                if (this.matchesToken("[^\"'\\\\]+")) {
                    this.addToken("string");

                    continue;
                }

                this.matchesToken(".");
                this.addToken("string");
                continue;
            }

            if (this.matchesToken("[\"']")) {
                // Opening string match

                this.state.currentStringOpener = this.currentToken;

                this.addToken("string");

                continue;
            }

            if (this.state.afterComparator) {
                // Attribute selector implicit string value

                this.state.afterComparator = false;

                if (this.matchesToken("[a-zA-Z0-9]+")) {
                    this.addToken("string");
                }

                continue;
            }

            if (this.state.inAttributeSelector && this.matchesToken("[is]", "\\]")) {
                // Attribute case sensitivity option match
                this.addToken("operator");
                continue;
            }

            if (this.state.inRule && this.matchesToken("[a-zA-Z\\-][a-zA-Z0-9\\-]*", "\\s*:")) {
                // Property name
                this.addToken("callIdentifier");
                continue;
            }

            if (this.matchesToken("@[a-zA-Z\\-][a-zA-Z0-9\\-]*")) {
                // At-rule

                this.state.inAtRule = true;

                this.addToken("keyword");

                continue;
            }

            if (this.state.inRule && this.matchesToken("#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?")) {
                // Hexadecimal colour literal
                this.addToken("number");

                continue;
            }

            if (this.matchesToken("[#.][a-zA-Z\\-][a-zA-Z0-9\\-]*")) {
                // Element ID or class selector name
                this.addToken("identifier");
                continue;
            }

            if (this.matchesToken("::?[a-zA-Z\\-][a-zA-Z0-9\\-]*")) {
                // Pseudo selector name
                this.addToken("callIdentifier");
                continue;
            }

            if (this.matchesToken("[a-zA-Z\\-][a-zA-Z0-9\\-]*")) {
                // Element name, attribute selector name or generic value

                this.addToken((
                    this.state.inRule ||
                    this.state.inAtRule ||
                    this.state.inAttributeSelector
                ) ? "identifier" : "keyword");

                continue;
            }

            if (this.matchesToken("(?:(?:[0-9]+)|(?:[0-9]*\\.[0-9]+))")) {
                // Number literal
                this.addToken("number");

                if (this.matchesToken("[a-zA-Z%]+")) {
                    // Numeric unit
                    this.addToken("identifier");
                }

                continue;
            }

            if (this.matchesTokens(COMPARATORS)) {
                // Attribute comparator match

                this.state.afterComparator = true;

                this.addToken("operator");

                continue;
            }

            if (this.matchesTokens(OPERATORS)) {
                // Attribute operator match
                this.addToken("operator");
                continue;
            }

            if (this.matchesToken("\\s+")) {
                // Whitespace match
                this.addToken("whitespace");
                continue;
            }

            // Fallback characters
            this.matchesToken(".");
            this.addToken("text");
        }

        this.state.inAtRule = false;
    }
}

parsers.register("css", CssParser);