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
        this.state.currentTagName = null;
        this.state.inAttributeValue = false;
        this.state.currentAttributeValueOpener = null;
        this.state.currentEmbeddedLanguage = null;
        this.state.currentEmbeddedParserState = {};
    }

    setEmbeddedLanguage() {
        if (this.state.currentTagName == "script") {
            this.state.currentEmbeddedLanguage = "javascript";
        }
    }

    tokenise() {
        while (this.remainingLine.length > 0) {
            if (this.state.currentEmbeddedLanguage != null) {
                var endPoint = this.remainingLine.indexOf(`</${this.state.currentTagName}>`);
                var parserClass = parsers.registeredParsers[this.state.currentEmbeddedLanguage] || parsers.Parser;

                if (endPoint == -1) {
                    endPoint = this.remainingLine.length;
                } else {
                    this.state.currentEmbeddedLanguage = null;
                }

                var embeddedCode = this.remainingLine.substring(0, endPoint);

                var parser = new parserClass(embeddedCode, this.state.currentEmbeddedParserState);

                parser.tokenise();

                this.state.currentEmbeddedParserState = JSON.parse(JSON.stringify(parser.state));
                this.remainingLine = this.remainingLine.substring(endPoint);

                this.tokens.push(...parser.tokens);

                continue;
            }

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

            if (this.matchesToken("&([a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);?")) {
                // Entity match
                this.addToken("escape");
                continue;
            }

            if (this.state.inAttributeValue) {
                if (this.state.currentAttributeValueOpener != null) {
                    if (this.matchesTokenString(this.state.currentAttributeValueOpener)) {
                        // Closing explicit attribute value symbol match

                        this.state.inAttributeValue = false;
                        this.state.currentAttributeValueOpener = null;

                        this.addToken("string");

                        continue;
                    }
                } else {
                    if (this.matchesToken("[>\\s]")) { 
                        // Closing implicit attribute value match

                        if (this.currentToken == ">") {
                            this.state.inTag = false;
                        }

                        this.state.inAttributeValue = false;
                        this.state.currentAttributeValueOpener = null;
    
                        this.setEmbeddedLanguage();
                        this.addToken("syntaxSymbol");
    
                        continue;
                    }

                    if (this.matchesToken("[\"']")) {
                        // Opening explicit attribute value symbol match
    
                        this.state.currentAttributeValueOpener = this.currentToken;
    
                        this.addToken("string");
    
                        continue;
                    }
                }

                // Attribute value match

                if (this.matchesToken("[^>\"'&\\s]+")) {
                    this.addToken("string");

                    continue;
                }

                this.matchesToken(".");
                this.addToken("string");

                continue;
            }

            if (this.state.inTag) {
                if (this.matchesToken("[^=>\"']+", "\\s*=\\s*")) {
                    // Attribute name with associated value match
                    this.addToken("identifier");

                    this.matchesToken("\\s*=\\s*");
                    this.addToken("syntaxSymbol");

                    this.state.inAttributeValue = true;

                    continue;
                }

                if (this.matchesToken("[^=>\"'\\s]+")) {
                    // Attribute name match
                    this.addToken("identifier");

                    continue;
                }

                if (this.matchesToken(">")) {
                    // Tag end match

                    this.state.inTag = false;

                    this.setEmbeddedLanguage();
                    this.addToken("syntaxSymbol");

                    continue;
                }

                // Fallback for text match
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
                // Tag symbol match

                this.addToken("syntaxSymbol");

                // Tag name match

                this.matchesToken("[^<>\"'\\s]+");

                this.state.inTag = true;
                this.state.currentTagName = this.currentToken.toLowerCase();

                this.addToken("keyword");

                continue;
            }

            // Generic text match

            if (this.matchesToken("[^<>&]+")) {
                this.addToken("text");
                continue;
            }

            this.matchesToken(".");
            this.addToken("text");
        }
    }
}

parsers.register("html", HtmlParser);