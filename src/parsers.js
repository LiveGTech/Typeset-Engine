/*
    Typeset Engine

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

export var registeredParsers = [];

export class Token {
    constructor(type, code) {
        this.type = type;
        this.code = code;
    }
}

export class Parser {
    constructor(line, previousState = {}) {
        this.line = line;
        this.remainingLine = line;
        this.tokens = [];
        this.currentToken = null;
        this.state = {};

        this.initState();

        this.state = {...structuredClone(this.state), ...structuredClone(previousState)};
    }

    matchesToken(token, contextAfter = ".*") {
        var matches = this.remainingLine.match(new RegExp(`^(?:${token})`, "sm"));

        if (matches && this.remainingLine.substring(matches[0].length).match(new RegExp(`^(?:${contextAfter})`, "s"))) {
            this.currentToken = matches[0];
            this.remainingLine = this.remainingLine.substring(matches[0].length);

            return true;
        }

        return false;
    }

    matchesTokens(tokens) {
        for (var i = 0; i < tokens.length; i++) {
            if (this.remainingLine.startsWith(tokens[i])) {
                this.currentToken = this.remainingLine.substring(0, tokens[i].length);
                this.remainingLine = this.remainingLine.substring(tokens[i].length);

                return true;
            }
        }

        return false;
    }

    matchesTokenString(token) {
        return this.matchesTokens(token);
    }

    addToken(type) {
        this.tokens.push(new Token(type, this.currentToken));
    }

    initState() {
        // To be optionally implemented by subclasses
    }

    tokenise() {
        // To be implemented by subclasses; just interpret all as text here
        this.matchesToken(".*");
        this.addToken("text");
    }
}

export class DirtyParser extends Parser {
    initState() {
        this.state._dirty = true;
    }
}

export function register(parser) {
    this.registeredParsers.push(parser);
}
